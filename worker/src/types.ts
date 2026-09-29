export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface Env {
  DB: D1Database;
  PAYMENT_BSC_ADDRESS: string;
  PAYMENT_ETHEREUM_ADDRESS: string;
  PAYMENT_TRON_ADDRESS: string;
  PAYMENT_POLYGON_ADDRESS: string;
  PAYMENT_SOLANA_ADDRESS: string;
  PAYMENT_TON_ADDRESS: string;
  FRONTEND_ORIGIN: string;
}

export type ContributionNetwork = 'bsc' | 'ethereum' | 'tron' | 'polygon' | 'solana' | 'ton';

export interface ContributionRow {
  id: string;
  message_id: string;
  requested_amount: string;
  token: 'USDT';
  network: ContributionNetwork;
  recipient_address: string;
  created_at: string;
}

export interface MessageRow {
  id: string;
  message: string;
  author: string | null;
  is_anonymous: number;
  font: string | null;
  color: string | null;
  created_at: string;
  overwritten_at: string | null;
  status: 'pending' | 'active' | 'overwritten';
  payment_id: string | null;
  contribution_id: string | null;
}
