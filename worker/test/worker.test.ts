import { afterEach, describe, expect, it } from 'vitest';
import { createWorker } from '../src/index';
import type { ContributionRow, D1Database, D1PreparedStatement, D1Result, Env, MessageRow } from '../src/types';

type Statement = D1PreparedStatement & { sql: string; values: unknown[] };

class FakeDatabase implements D1Database {
  readonly contributions = new Map<string, ContributionRow>();
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
    if (statement.sql.includes('SELECT * FROM contribution_requests WHERE id')) {
      return (this.contributions.get(String(statement.values[0])) ?? null) as T | null;
    }
    if (statement.sql.includes('SELECT * FROM wall_messages WHERE id')) {
      return (this.messages.get(String(statement.values[0])) ?? null) as T | null;
    }
    if (statement.sql.includes("status = 'active'")) {
      return ([...this.messages.values()].find((message) => message.status === 'active') ?? null) as T | null;
    }
    if (statement.sql.includes('survival_seconds')) {
      const message = [...this.messages.values()].find((item) => item.status === 'overwritten');
      return (message ? { ...message, survival_seconds: 60 } : null) as T | null;
    }
    return null;
  }

  private async all<T>(_statement: Statement): Promise<D1Result<T>> {
    const messages = [...this.messages.values()].filter((message) => message.status === 'overwritten');
    return { success: true, results: messages as T[] };
  }

  private async run(statement: Statement): Promise<D1Result> {
    const { sql, values } = statement;
    if (sql.startsWith('INSERT INTO wall_messages')) {
      const [id, message, author, isAnonymous, createdAt, contributionId] = values as [string, string, string | null, number, string, string];
      this.messages.set(id, { id, message, author, is_anonymous: isAnonymous, font: null, color: null, created_at: createdAt, overwritten_at: null, status: 'pending', payment_id: null, contribution_id: contributionId });
    } else if (sql.startsWith('INSERT INTO contribution_requests')) {
      const [id, messageId, network, recipientAddress, createdAt] = values as [string, string, ContributionRow['network'], string, string];
      this.contributions.set(id, { id, message_id: messageId, requested_amount: '1', token: 'USDT', network, recipient_address: recipientAddress, created_at: createdAt });
    } else if (sql.startsWith('UPDATE contribution_requests SET network')) {
      const [network, recipientAddress, contributionId] = values as [ContributionRow['network'], string, string];
      const contribution = this.contributions.get(contributionId);
      if (contribution) Object.assign(contribution, { network, recipient_address: recipientAddress });
    } else if (sql.startsWith("UPDATE wall_messages SET status = 'overwritten'")) {
      const [overwrittenAt] = values as [string];
      for (const message of this.messages.values()) {
        if (message.status === 'active') Object.assign(message, { status: 'overwritten', overwritten_at: overwrittenAt });
      }
    } else if (sql.startsWith("UPDATE wall_messages SET status = 'active'")) {
      const message = this.messages.get(String(values[0]));
      if (message?.status === 'pending') message.status = 'active';
    }
    return { success: true };
  }
}

const db = new FakeDatabase();
const env: Env = {
  DB: db,
  PAYMENT_BSC_ADDRESS: '0xBscContributionAddress',
  PAYMENT_ETHEREUM_ADDRESS: '0xEthereumContributionAddress',
  PAYMENT_TRON_ADDRESS: 'TTronContributionAddress',
  PAYMENT_POLYGON_ADDRESS: '0xPolygonContributionAddress',
  PAYMENT_SOLANA_ADDRESS: 'SolanaContributionAddress',
  PAYMENT_TON_ADDRESS: 'UQTonContributionAddress',
  FRONTEND_ORIGIN: 'https://wall.rest',
};
const worker = createWorker();
const request = (path: string, init: RequestInit = {}) => worker.fetch(new Request(`https://worker.example${path}`, init), env);

const createContribution = async () => {
  const response = await request('/api/overwrites', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'A valid message', author: 'Artist', isAnonymous: false }),
  });
  return (await response.json()) as { data: { contribution: { id: string; networks: { id: string; address: string }[] } } };
};

afterEach(() => { db.contributions.clear(); db.messages.clear(); });

describe('The Wall contribution flow', () => {
  it('serves the health endpoint', async () => {
    const response = await request('/api/health');
    expect(response.status).toBe(200);
  });

  it('creates a voluntary contribution request with every configured network', async () => {
    const body = await createContribution();
    expect(body.data.contribution.networks.map(({ id }) => id)).toEqual(['bsc', 'ethereum', 'tron', 'polygon', 'solana', 'ton']);
    expect(body.data.contribution.networks.find(({ id }) => id === 'tron')?.address).toBe(env.PAYMENT_TRON_ADDRESS);
  });

  it.each(['bsc', 'ethereum', 'tron', 'polygon', 'solana', 'ton'] as const)(
    'publishes when continuing with %s without payment verification',
    async (network) => {
      const created = await createContribution();
      const contributionId = created.data.contribution.id;
      const response = await request(`/api/contributions/${contributionId}/continue`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ network }),
      });
      const body = (await response.json()) as { data: { contribution: ContributionRow; message: MessageRow } };
      expect(response.status).toBe(200);
      expect(body.data.contribution.network).toBe(network);
      expect(body.data.message.status).toBe('active');
    }
  );

});
