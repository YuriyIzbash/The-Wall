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
  TRONSCAN_API_URL: string;
  TRONSCAN_API_KEY: string;
  WALL_RECEIVING_ADDRESS: string;
  USDT_CONTRACT_ADDRESS: string;
  PAYMENT_EXPIRATION_MINUTES: string;
  FRONTEND_ORIGIN: string;
}

export interface PaymentRow {
  id: string;
  message_id: string;
  expected_amount: string;
  token: 'USDT';
  network: 'TRON';
  recipient_address: string;
  transaction_hash: string | null;
  sender_address: string | null;
  status: 'pending' | 'confirmed' | 'invalid' | 'expired';
  created_at: string;
  expires_at: string;
  confirmed_at: string | null;
  verification_attempts: number;
  last_checked_at: string | null;
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
  payment_id: string;
}
