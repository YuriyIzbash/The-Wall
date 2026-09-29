import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorker } from '../src/index';
import type {
  D1Database,
  D1PreparedStatement,
  D1Result,
  Env,
  MessageRow,
  PaymentRow,
} from '../src/types';

type Statement = D1PreparedStatement & { sql: string; values: unknown[] };

class FakeDatabase implements D1Database {
  readonly payments = new Map<string, PaymentRow>();
  readonly messages = new Map<string, MessageRow>();

  prepare(sql: string): Statement {
    const statement: Statement = {
      sql,
      values: [],
      bind: (...values: unknown[]) => {
        statement.values = values;
        return statement;
      },
      first: async <T>() => this.first<T>(statement),
      all: async <T>() => this.all<T>(statement),
      run: async () => this.run(statement),
    };
    return statement;
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    for (const raw of statements) await this.run(raw as Statement);
    return statements.map(() => ({ success: true }));
  }

  private async first<T>(statement: Statement): Promise<T | null> {
    if (statement.sql.includes('SELECT * FROM payments WHERE id')) {
      return (this.payments.get(String(statement.values[0])) ?? null) as T | null;
    }
    if (statement.sql.includes('SELECT * FROM wall_messages WHERE id')) {
      return (this.messages.get(String(statement.values[0])) ?? null) as T | null;
    }
    if (statement.sql.includes('SELECT id FROM payments WHERE transaction_hash')) {
      const row = [...this.payments.values()].find(
        (payment) => payment.transaction_hash === statement.values[0]
      );
      return (row ? { id: row.id } : null) as T | null;
    }
    if (statement.sql.includes("status = 'active'")) {
      return ([...this.messages.values()].find((message) => message.status === 'active') ??
        null) as T | null;
    }
    if (statement.sql.includes('survival_seconds')) {
      const message = [...this.messages.values()]
        .filter((item) => item.status === 'overwritten')
        .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0];
      return (message ? { ...message, survival_seconds: 60 } : null) as T | null;
    }
    return null;
  }

  private async all<T>(statement: Statement): Promise<D1Result<T>> {
    const messages = [...this.messages.values()].filter(
      (message) => message.status === 'overwritten'
    );
    return { success: true, results: messages as T[] };
  }

  private async run(statement: Statement): Promise<D1Result> {
    const { sql, values } = statement;
    if (sql.startsWith('INSERT INTO wall_messages')) {
      const [id, message, author, isAnonymous, createdAt, paymentId] = values as [
        string,
        string,
        string | null,
        number,
        string,
        string,
      ];
      this.messages.set(id, {
        id,
        message,
        author,
        is_anonymous: isAnonymous,
        font: null,
        color: null,
        created_at: createdAt,
        overwritten_at: null,
        status: 'pending',
        payment_id: paymentId,
      });
    } else if (sql.startsWith('INSERT INTO payments')) {
      const [id, messageId, expectedAmount, recipientAddress, createdAt, expiresAt] = values as [
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      this.payments.set(id, {
        id,
        message_id: messageId,
        expected_amount: expectedAmount,
        token: 'USDT',
        network: 'TRON',
        recipient_address: recipientAddress,
        transaction_hash: null,
        sender_address: null,
        status: 'pending',
        created_at: createdAt,
        expires_at: expiresAt,
        confirmed_at: null,
        verification_attempts: 0,
        last_checked_at: null,
      });
    } else if (sql.startsWith("UPDATE payments SET status = 'confirmed'")) {
      const [hash, sender, confirmedAt, checkedAt, paymentId, cutoff] = values as [
        string,
        string | null,
        string,
        string,
        string,
        string,
      ];
      const payment = this.payments.get(paymentId);
      if (payment && payment.status === 'pending' && payment.expires_at > cutoff) {
        payment.status = 'confirmed';
        payment.transaction_hash = hash;
        payment.sender_address = sender;
        payment.confirmed_at = confirmedAt;
        payment.last_checked_at = checkedAt;
        payment.verification_attempts += 1;
      }
    } else if (sql.startsWith("UPDATE wall_messages SET status = 'overwritten'")) {
      const [overwrittenAt, paymentId] = values as [string, string];
      if (this.payments.get(paymentId)?.status === 'confirmed') {
        for (const message of this.messages.values()) {
          if (message.status === 'active') {
            message.status = 'overwritten';
            message.overwritten_at = overwrittenAt;
          }
        }
      }
    } else if (sql.startsWith("UPDATE wall_messages SET status = 'active'")) {
      const [messageId, paymentId] = values as [string, string];
      const message = this.messages.get(messageId);
      if (
        message &&
        message.status === 'pending' &&
        this.payments.get(paymentId)?.status === 'confirmed'
      ) {
        message.status = 'active';
      }
    } else if (sql.startsWith('UPDATE payments SET verification_attempts')) {
      const checkedAt = String(values[0]);
      const paymentId = String(values.at(-1));
      const payment = this.payments.get(paymentId);
      if (payment) {
        payment.verification_attempts += 1;
        payment.last_checked_at = checkedAt;
        if (sql.includes("status = 'invalid'")) payment.status = 'invalid';
        if (sql.includes("status = 'expired'")) payment.status = 'expired';
      }
    }
    return { success: true };
  }
}

const validHash = 'a'.repeat(64);
const db = new FakeDatabase();
const env: Env = {
  DB: db,
  TRONSCAN_API_URL: 'https://tronscan.example/api/transaction-info',
  TRONSCAN_API_KEY: 'test-secret',
  WALL_RECEIVING_ADDRESS: 'TY8uAhzywQm76gqrg9NsaM6RBhYGuC3dCf',
  USDT_CONTRACT_ADDRESS: 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj',
  PAYMENT_EXPIRATION_MINUTES: '30',
  FRONTEND_ORIGIN: 'https://wall.rest',
};
const worker = createWorker();

const request = (path: string, init: RequestInit = {}) =>
  worker.fetch(new Request(`https://worker.example${path}`, init), env);

const createPayment = async () => {
  const response = await request('/api/overwrites', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'A valid message', author: 'Artist', isAnonymous: false }),
  });
  return ((await response.json()) as { data: { paymentId: string } }).data.paymentId;
};

const tronPayload = (overrides: Record<string, unknown> = {}) => ({
  contractRet: 'SUCCESS',
  tokenTransferInfo: {
    tokenInfo: { tokenAbbr: 'USDT', tokenId: env.USDT_CONTRACT_ADDRESS },
    to_address: env.WALL_RECEIVING_ADDRESS,
    from_address: 'TTestSenderAddress',
    amount_str: '1000000',
  },
  ...overrides,
});

const mockTronscan = (payload: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
    )
  );

afterEach(() => {
  vi.unstubAllGlobals();
  db.payments.clear();
  db.messages.clear();
});

describe('The Wall Worker API', () => {
  it('serves the health endpoint', async () => {
    const response = await request('/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('creates a pending overwrite and exposes its payment', async () => {
    const paymentId = await createPayment();
    const lookup = await request(`/api/payments/${paymentId}`);
    const body = (await lookup.json()) as { data: { status: string; amountBaseUnits: string } };
    expect(lookup.status).toBe(200);
    expect(body.data).toMatchObject({ status: 'pending', amountBaseUnits: '1000000' });
  });

  it('rejects an invalid message', async () => {
    const response = await request('/api/overwrites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '   ', author: 'Artist', isAnonymous: false }),
    });
    expect(response.status).toBe(400);
  });

  it('rejects an invalid author', async () => {
    const response = await request('/api/overwrites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Valid', author: 'x'.repeat(51), isAnonymous: false }),
    });
    expect(response.status).toBe(400);
  });

  it('rejects a malformed transaction hash', async () => {
    const paymentId = await createPayment();
    const response = await request(`/api/payments/${paymentId}/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transactionHash: 'not-a-tron-hash' }),
    });
    expect((await response.json()) as unknown).toMatchObject({
      error: { code: 'invalid_transaction_hash' },
    });
  });

  it('rejects a transfer sent to the wrong recipient', async () => {
    const paymentId = await createPayment();
    mockTronscan(
      tronPayload({
        tokenTransferInfo: { ...tronPayload().tokenTransferInfo, to_address: 'TOtherAddress' },
      })
    );
    const response = await request(`/api/payments/${paymentId}/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transactionHash: validHash }),
    });
    expect((await response.json()) as unknown).toMatchObject({
      error: { code: 'wrong_recipient' },
    });
  });

  it('rejects a non-USDT token', async () => {
    const paymentId = await createPayment();
    mockTronscan(
      tronPayload({
        tokenTransferInfo: {
          ...tronPayload().tokenTransferInfo,
          tokenInfo: { tokenAbbr: 'USDC', tokenId: env.USDT_CONTRACT_ADDRESS },
        },
      })
    );
    const response = await request(`/api/payments/${paymentId}/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transactionHash: validHash }),
    });
    expect((await response.json()) as unknown).toMatchObject({ error: { code: 'wrong_token' } });
  });

  it('rejects the wrong USDT contract', async () => {
    const paymentId = await createPayment();
    mockTronscan(
      tronPayload({
        tokenTransferInfo: {
          ...tronPayload().tokenTransferInfo,
          tokenInfo: { tokenAbbr: 'USDT', tokenId: 'TWrongContract' },
        },
      })
    );
    const response = await request(`/api/payments/${paymentId}/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transactionHash: validHash }),
    });
    expect((await response.json()) as unknown).toMatchObject({ error: { code: 'wrong_contract' } });
  });

  it('rejects an insufficient integer base-unit amount', async () => {
    const paymentId = await createPayment();
    mockTronscan(
      tronPayload({
        tokenTransferInfo: { ...tronPayload().tokenTransferInfo, amount_str: '999999' },
      })
    );
    const response = await request(`/api/payments/${paymentId}/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transactionHash: validHash }),
    });
    expect((await response.json()) as unknown).toMatchObject({
      error: { code: 'insufficient_amount' },
    });
  });

  it('rejects a transaction hash that belongs to another payment', async () => {
    const paymentId = await createPayment();
    db.payments.set('11111111-1111-4111-8111-111111111111', {
      ...db.payments.get(paymentId)!,
      id: '11111111-1111-4111-8111-111111111111',
      transaction_hash: validHash,
    });
    const response = await request(`/api/payments/${paymentId}/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transactionHash: validHash }),
    });
    expect((await response.json()) as unknown).toMatchObject({
      error: { code: 'duplicate_transaction' },
    });
  });

  it('expires a pending payment before checking the blockchain', async () => {
    const paymentId = await createPayment();
    db.payments.get(paymentId)!.expires_at = '2000-01-01T00:00:00.000Z';
    const response = await request(`/api/payments/${paymentId}/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transactionHash: validHash }),
    });
    expect((await response.json()) as unknown).toMatchObject({
      error: { code: 'payment_expired' },
    });
  });
});
