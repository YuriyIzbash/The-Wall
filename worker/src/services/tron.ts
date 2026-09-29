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
  if (payload.contractRet === 'SUCCESS' || payload.contract_ret === 'SUCCESS') return true;
  if (payload.success === true) return true;
  const ret = Array.isArray(payload.ret) ? asRecord(payload.ret[0]) : null;
  return ret?.contractRet === 'SUCCESS' || ret?.contract_ret === 'SUCCESS';
};

const transferFrom = (payload: UnknownRecord): UnknownRecord | null => {
  const candidates = [
    payload.tokenTransferInfo,
    payload.token_transfer_info,
    payload.trc20TransferInfo,
    payload.trc20_transfer_info,
  ];
  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (record) return record;
  }
  return null;
};

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

    const transfer = transferFrom(payload);
    if (!transfer) return { ok: false, reason: 'missing_transfer' };

    const tokenInfo = asRecord(transfer.tokenInfo) ?? asRecord(transfer.token_info);
    const tokenName = firstString(
      tokenInfo?.tokenAbbr,
      tokenInfo?.symbol,
      transfer.tokenName,
      transfer.token_name
    );
    if (tokenName !== 'USDT') return { ok: false, reason: 'wrong_token' };

    const contract = firstString(
      tokenInfo?.tokenId,
      tokenInfo?.address,
      transfer.contract_address,
      transfer.contractAddress,
      transfer.token_address
    );
    if (contract !== this.env.USDT_CONTRACT_ADDRESS) return { ok: false, reason: 'wrong_contract' };

    const recipient = firstString(transfer.to_address, transfer.toAddress, transfer.to);
    if (recipient !== this.env.WALL_RECEIVING_ADDRESS)
      return { ok: false, reason: 'wrong_recipient' };

    const amount = firstString(transfer.amount_str, transfer.amount, transfer.quant);
    if (!amount || !/^\d+$/.test(amount)) return { ok: false, reason: 'insufficient_amount' };
    if (BigInt(amount) < MINIMUM_USDT_BASE_UNITS)
      return { ok: false, reason: 'insufficient_amount' };

    return {
      ok: true,
      senderAddress: firstString(transfer.from_address, transfer.fromAddress, transfer.from),
      amountBaseUnits: amount,
    };
  }
}
