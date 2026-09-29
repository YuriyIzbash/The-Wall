import type { Env } from '../types';

export const USDT_DECIMALS = 6;
export const MINIMUM_USDT_BASE_UNITS = 1_000_000n;

export type VerificationFailure =
  | 'transaction_not_found'
  | 'transaction_failed'
  | 'missing_transfer'
  | 'wrong_token'
  | 'wrong_contract'
  | 'wrong_recipient'
  | 'insufficient_amount';

export type TronVerification =
  | { ok: true; senderAddress: string | null; amountBaseUnits: string }
  | { ok: false; reason: VerificationFailure };

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;

const firstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
};

const isSuccessful = (payload: UnknownRecord): boolean => {
  if (payload.revert === true) return false;
  const contractResult = firstString(payload.contractRet, payload.contract_ret);
  if (contractResult !== null) return contractResult === 'SUCCESS';
  const ret = Array.isArray(payload.ret) ? asRecord(payload.ret[0]) : null;
  const returnResult = firstString(ret?.contractRet, ret?.contract_ret);
  if (returnResult !== null) return returnResult === 'SUCCESS';
  return payload.success === true;
};

const asRecords = (value: unknown): UnknownRecord[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const record = asRecord(item);
      return record ? [record] : [];
    });
  }
  const record = asRecord(value);
  return record ? [record] : [];
};

const transferCandidates = (payload: UnknownRecord): UnknownRecord[] => [
  // TRONSCAN documents these two fields as arrays.
  ...asRecords(payload.trc20TransferInfo),
  ...asRecords(payload.trc20_transfer_info),
  // Older/single-transfer responses expose the same element schema as an object.
  ...asRecords(payload.tokenTransferInfo),
  ...asRecords(payload.token_transfer_info),
];

const transferRecipient = (transfer: UnknownRecord): string | null =>
  firstString(transfer.to_address, transfer.toAddress, transfer.to);

const optionalValue = (...values: unknown[]): unknown =>
  values.find((value) => value !== undefined && value !== null);

const successfulTransferStatus = (status: unknown): boolean =>
  status === undefined ||
  status === null ||
  status === 0 ||
  status === '0' ||
  status === 'SUCCESS' ||
  status === 'success';

const validTrc20Type = (tokenType: unknown): boolean =>
  tokenType === undefined ||
  tokenType === null ||
  (typeof tokenType === 'string' && tokenType.toLowerCase() === 'trc20');

const validUsdtDecimals = (decimals: unknown): boolean =>
  decimals === undefined || decimals === null || decimals === USDT_DECIMALS || decimals === '6';

/** Verifies TRONSCAN data independently of browser-provided payment details. */
export class TronService {
  constructor(
    private readonly env: Pick<
      Env,
      'TRONSCAN_API_URL' | 'TRONSCAN_API_KEY' | 'WALL_RECEIVING_ADDRESS' | 'USDT_CONTRACT_ADDRESS'
    >,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async verifyTransaction(transactionHash: string): Promise<TronVerification> {
    const url = new URL(this.env.TRONSCAN_API_URL);
    url.searchParams.set('hash', transactionHash);

    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers: { 'TRON-PRO-API-KEY': this.env.TRONSCAN_API_KEY },
      });
    } catch {
      return { ok: false, reason: 'transaction_not_found' };
    }

    if (!response.ok) return { ok: false, reason: 'transaction_not_found' };
    const payload = asRecord(await response.json().catch(() => null));
    if (!payload || Object.keys(payload).length === 0)
      return { ok: false, reason: 'transaction_not_found' };
    if (!isSuccessful(payload)) return { ok: false, reason: 'transaction_failed' };

    const transfers = transferCandidates(payload);
    if (transfers.length === 0) return { ok: false, reason: 'missing_transfer' };

    // A transaction may contain several transfers. Only a transfer sent to this payment's
    // configured receiving address can settle it; unrelated transfers must not affect it.
    const matchingRecipient = transfers.filter(
      (transfer) => transferRecipient(transfer) === this.env.WALL_RECEIVING_ADDRESS
    );
    if (matchingRecipient.length === 0) {
      const hasRecipient = transfers.some((transfer) => transferRecipient(transfer) !== null);
      return { ok: false, reason: hasRecipient ? 'wrong_recipient' : 'missing_transfer' };
    }

    let failure: VerificationFailure = 'missing_transfer';
    for (const transfer of matchingRecipient) {
      const tokenInfo = asRecord(transfer.tokenInfo) ?? asRecord(transfer.token_info);
      const tokenName = firstString(
        transfer.symbol,
        transfer.token_symbol,
        tokenInfo?.tokenAbbr,
        tokenInfo?.symbol,
        transfer.tokenName,
        transfer.token_name
      );
      if (tokenName !== 'USDT') {
        failure = 'wrong_token';
        continue;
      }

      const contract = firstString(
        transfer.contract_address,
        transfer.contractAddress,
        transfer.token_address,
        tokenInfo?.tokenId,
        tokenInfo?.address
      );
      if (contract !== this.env.USDT_CONTRACT_ADDRESS) {
        failure = 'wrong_contract';
        continue;
      }

      const tokenType = optionalValue(
        transfer.tokenType,
        transfer.token_type,
        transfer.tokenType2,
        tokenInfo?.tokenType,
        tokenInfo?.token_type
      );
      if (!validTrc20Type(tokenType)) {
        failure = 'missing_transfer';
        continue;
      }

      const transferKind = optionalValue(transfer.type, transfer.transfer_type);
      if (
        transferKind !== undefined &&
        transferKind !== null &&
        (typeof transferKind !== 'string' || transferKind.toLowerCase() !== 'transfer')
      ) {
        failure = 'missing_transfer';
        continue;
      }

      const decimals = optionalValue(
        transfer.decimals,
        transfer.tokenDecimal,
        transfer.token_decimal,
        tokenInfo?.tokenDecimal,
        tokenInfo?.decimals
      );
      if (!validUsdtDecimals(decimals)) {
        failure = 'wrong_token';
        continue;
      }

      const status = optionalValue(transfer.status, transfer.transfer_status);
      if (!successfulTransferStatus(status)) {
        failure = 'transaction_failed';
        continue;
      }

      const amount = firstString(transfer.amount_str, transfer.amount, transfer.quant);
      if (!amount || !/^\d+$/.test(amount) || BigInt(amount) < MINIMUM_USDT_BASE_UNITS) {
        failure = 'insufficient_amount';
        continue;
      }

      return {
        ok: true,
        senderAddress: firstString(transfer.from_address, transfer.fromAddress, transfer.from),
        amountBaseUnits: amount,
      };
    }

    return { ok: false, reason: failure };
  }
}
