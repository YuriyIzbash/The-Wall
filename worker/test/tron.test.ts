import { describe, expect, it } from 'vitest';
import { TronService } from '../src/services/tron';

const env = {
  TRONSCAN_API_URL: 'https://apilist.tronscanapi.com/api/transaction-info',
  TRONSCAN_API_KEY: 'test-secret',
  WALL_RECEIVING_ADDRESS: 'TY8uAhzywQm76gqrg9NsaM6RBhYGuC3dCf',
  USDT_CONTRACT_ADDRESS: 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj',
};

const transactionHash = 'a'.repeat(64);

const trc20Transfer = (overrides: Record<string, unknown> = {}) => ({
  symbol: 'USDT',
  to_address: env.WALL_RECEIVING_ADDRESS,
  contract_address: env.USDT_CONTRACT_ADDRESS,
  type: 'Transfer',
  tokenType: 'trc20',
  decimals: 6,
  from_address: 'TTestSenderAddress',
  amount_str: '1000000',
  status: 0,
  ...overrides,
});

const transactionInfo = (transfers: unknown, overrides: Record<string, unknown> = {}) => ({
  hash: transactionHash,
  confirmed: true,
  revert: false,
  contractRet: 'SUCCESS',
  trc20TransferInfo: transfers,
  ...overrides,
});

const verify = async (payload: unknown) => {
  const service = new TronService(
    env,
    async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
  );
  return service.verifyTransaction(transactionHash);
};

describe('TronService transaction-info verification', () => {
  it('accepts a realistic 1 USDT trc20TransferInfo array element', async () => {
    await expect(verify(transactionInfo([trc20Transfer()]))).resolves.toEqual({
      ok: true,
      senderAddress: 'TTestSenderAddress',
      amountBaseUnits: '1000000',
    });
  });

  it('rejects a transfer greater than the exact 1 USDT price without floating-point conversion', async () => {
    await expect(
      verify(transactionInfo([trc20Transfer({ amount_str: '2500001' })]))
    ).resolves.toEqual({ ok: false, reason: 'incorrect_amount' });
  });

  it('rejects a transfer with the wrong recipient', async () => {
    await expect(
      verify(transactionInfo([trc20Transfer({ to_address: 'TOtherRecipientAddress' })]))
    ).resolves.toEqual({ ok: false, reason: 'wrong_recipient' });
  });

  it('rejects a transfer with the wrong contract', async () => {
    await expect(
      verify(transactionInfo([trc20Transfer({ contract_address: 'TWrongContractAddress' })]))
    ).resolves.toEqual({ ok: false, reason: 'wrong_contract' });
  });

  it('rejects a transfer with the wrong token symbol', async () => {
    await expect(verify(transactionInfo([trc20Transfer({ symbol: 'USDC' })]))).resolves.toEqual({
      ok: false,
      reason: 'wrong_token',
    });
  });

  it('rejects a raw amount below 1 USDT', async () => {
    await expect(
      verify(transactionInfo([trc20Transfer({ amount_str: '999999' })]))
    ).resolves.toEqual({
      ok: false,
      reason: 'insufficient_amount',
    });
  });

  it('rejects a failed transaction even when it lists a transfer', async () => {
    await expect(
      verify(transactionInfo([trc20Transfer()], { contractRet: 'REVERT', revert: true }))
    ).resolves.toEqual({ ok: false, reason: 'transaction_failed' });
  });

  it('waits for TRON finality before accepting an otherwise valid transfer', async () => {
    await expect(
      verify(transactionInfo([trc20Transfer()], { confirmed: false }))
    ).resolves.toEqual({ ok: false, reason: 'transaction_unconfirmed' });
  });

  it('requires the exact 1 USDT amount', async () => {
    await expect(
      verify(transactionInfo([trc20Transfer({ amount_str: '1000001' })]))
    ).resolves.toEqual({ ok: false, reason: 'incorrect_amount' });
  });

  it('rejects a successful transaction with no trc20 transfer', async () => {
    await expect(verify(transactionInfo([]))).resolves.toEqual({
      ok: false,
      reason: 'missing_transfer',
    });
  });

  it('selects the recipient-matching transfer from a multi-transfer transaction', async () => {
    const unrelatedTransfer = trc20Transfer({
      to_address: 'TAnotherRecipientAddress',
      amount_str: '900000000000',
    });
    await expect(
      verify(transactionInfo([unrelatedTransfer, trc20Transfer()]))
    ).resolves.toMatchObject({
      ok: true,
      amountBaseUnits: '1000000',
    });
  });

  it('rejects malformed transfer records', async () => {
    await expect(
      verify(transactionInfo([{ symbol: 'USDT', amount_str: '1000000' }]))
    ).resolves.toEqual({
      ok: false,
      reason: 'missing_transfer',
    });
  });

  it('requires TRC20 type, six decimals, and a successful transfer status when supplied', async () => {
    await expect(verify(transactionInfo([trc20Transfer({ tokenType: 'trc10' })]))).resolves.toEqual(
      {
        ok: false,
        reason: 'missing_transfer',
      }
    );
    await expect(verify(transactionInfo([trc20Transfer({ decimals: 18 })]))).resolves.toEqual({
      ok: false,
      reason: 'wrong_token',
    });
    await expect(verify(transactionInfo([trc20Transfer({ status: 1 })]))).resolves.toEqual({
      ok: false,
      reason: 'transaction_failed',
    });
  });

  it('retains tokenTransferInfo object compatibility', async () => {
    const { trc20TransferInfo: _trc20TransferInfo, ...payload } = transactionInfo(undefined);
    await expect(
      verify({
        ...payload,
        tokenTransferInfo: {
          tokenInfo: { tokenAbbr: 'USDT', tokenId: env.USDT_CONTRACT_ADDRESS, tokenDecimal: '6' },
          to_address: env.WALL_RECEIVING_ADDRESS,
          from_address: 'TTestSenderAddress',
          amount_str: '1000000',
        },
      })
    ).resolves.toMatchObject({ ok: true, amountBaseUnits: '1000000' });
  });
});
