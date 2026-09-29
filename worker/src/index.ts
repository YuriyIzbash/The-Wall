import { failure, success, withCors } from './http';
import { TronService, type VerificationFailure } from './services/tron';
import type { D1Database, Env, MessageRow, PaymentRow } from './types';

const MESSAGE_MAX_LENGTH = 100;
const AUTHOR_MAX_LENGTH = 50;
const TRANSACTION_HASH_PATTERN = /^[a-fA-F0-9]{64}$/;
const PAYMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPECTED_AMOUNT_BASE_UNITS = '1000000';

class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

const isoNow = (): string => new Date().toISOString();

const paymentResponse = (payment: PaymentRow) => ({
  id: payment.id,
  messageId: payment.message_id,
  amount: '1',
  amountBaseUnits: payment.expected_amount,
  token: payment.token,
  network: payment.network,
  recipientAddress: payment.recipient_address,
  transactionHash: payment.transaction_hash,
  senderAddress: payment.sender_address,
  status: payment.status,
  createdAt: payment.created_at,
  expiresAt: payment.expires_at,
  confirmedAt: payment.confirmed_at,
});

const messageResponse = (message: MessageRow) => ({
  id: message.id,
  message: message.message,
  author: message.is_anonymous === 1 ? null : message.author,
  isAnonymous: message.is_anonymous === 1,
  font: message.font,
  color: message.color,
  createdAt: message.created_at,
  overwrittenAt: message.overwritten_at,
  status: message.status,
  paymentId: message.payment_id,
});

const getPayment = (db: D1Database, paymentId: string) =>
  db.prepare('SELECT * FROM payments WHERE id = ?').bind(paymentId).first<PaymentRow>();

const getMessage = (db: D1Database, messageId: string) =>
  db.prepare('SELECT * FROM wall_messages WHERE id = ?').bind(messageId).first<MessageRow>();

const parseJson = async (request: Request): Promise<Record<string, unknown>> => {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new ApiError('invalid_content_type', 'Content-Type must be application/json.', 415);
  }
  try {
    const body = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new ApiError('invalid_json', 'Request body must be valid JSON.', 400);
  }
};

const requiredString = (value: unknown, name: string, maximumLength: number): string => {
  if (typeof value !== 'string') {
    throw new ApiError('invalid_input', `${name} must be a string.`, 400);
  }
  const normalized = value.trim();
  if (!normalized) throw new ApiError('invalid_input', `${name} is required.`, 400);
  if (normalized.length > maximumLength) {
    throw new ApiError(
      'invalid_input',
      `${name} must not exceed ${maximumLength} characters.`,
      400
    );
  }
  return normalized;
};

const validateOverwrite = (body: Record<string, unknown>) => {
  const message = requiredString(body.message, 'message', MESSAGE_MAX_LENGTH);
  if (typeof body.isAnonymous !== 'boolean') {
    throw new ApiError('invalid_input', 'isAnonymous must be a boolean.', 400);
  }
  const isAnonymous = body.isAnonymous;
  if (isAnonymous) return { message, isAnonymous, author: null };
  return { message, isAnonymous, author: requiredString(body.author, 'author', AUTHOR_MAX_LENGTH) };
};

const validatePaymentId = (paymentId: string): void => {
  if (!PAYMENT_ID_PATTERN.test(paymentId)) {
    throw new ApiError('invalid_payment_id', 'paymentId is malformed.', 400);
  }
};

const failureDetails: Record<
  VerificationFailure,
  { code: string; message: string; invalid: boolean }
> = {
  transaction_not_found: {
    code: 'transaction_not_found',
    message: 'The transaction could not be found yet.',
    invalid: false,
  },
  transaction_unconfirmed: {
    code: 'transaction_unconfirmed',
    message: 'The transaction is waiting for confirmation on TRON.',
    invalid: false,
  },
  transaction_failed: {
    code: 'transaction_failed',
    message: 'The transaction did not succeed on TRON.',
    invalid: true,
  },
  missing_transfer: {
    code: 'missing_transfer',
    message: 'The transaction does not contain a supported TRC-20 transfer.',
    invalid: true,
  },
  wrong_token: { code: 'wrong_token', message: 'The transfer token is not USDT.', invalid: true },
  wrong_contract: {
    code: 'wrong_contract',
    message: 'The transfer did not use the configured USDT contract.',
    invalid: true,
  },
  wrong_recipient: {
    code: 'wrong_recipient',
    message: 'The transfer was not sent to the Wall receiving address.',
    invalid: true,
  },
  insufficient_amount: {
    code: 'insufficient_amount',
    message: 'The transfer amount is below 1 USDT.',
    invalid: true,
  },
  incorrect_amount: {
    code: 'incorrect_amount',
    message: 'The transfer amount must be exactly 1 USDT.',
    invalid: true,
  },
};

const markAttempt = async (
  db: D1Database,
  paymentId: string,
  checkedAt: string,
  status?: 'invalid' | 'expired',
  transactionHash?: string
) => {
  if (status) {
    await db
      .prepare(
        "UPDATE payments SET verification_attempts = verification_attempts + 1, last_checked_at = ?, status = ?, transaction_hash = COALESCE(transaction_hash, ?) WHERE id = ? AND status = 'pending'"
      )
      .bind(checkedAt, status, transactionHash ?? null, paymentId)
      .run();
    return;
  }
  await db
    .prepare(
      "UPDATE payments SET verification_attempts = verification_attempts + 1, last_checked_at = ? WHERE id = ? AND status = 'pending'"
    )
    .bind(checkedAt, paymentId)
    .run();
};

const getCurrentPayment = async (db: D1Database, paymentId: string): Promise<PaymentRow | null> => {
  const payment = await getPayment(db, paymentId);
  if (!payment || payment.status !== 'pending' || new Date(payment.expires_at).getTime() > Date.now()) {
    return payment;
  }

  await db
    .prepare("UPDATE payments SET status = 'expired' WHERE id = ? AND status = 'pending' AND expires_at <= ?")
    .bind(paymentId, isoNow())
    .run();
  return getPayment(db, paymentId);
};

const createOverwrite = async (request: Request, env: Env): Promise<Response> => {
  const payload = validateOverwrite(await parseJson(request));
  const now = new Date();
  const createdAt = now.toISOString();
  const minutes = Number.parseInt(env.PAYMENT_EXPIRATION_MINUTES, 10);
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 24 * 60) {
    throw new ApiError(
      'configuration_error',
      'Payment expiration is not configured correctly.',
      500
    );
  }
  const expiresAt = new Date(now.getTime() + minutes * 60_000).toISOString();
  const paymentId = crypto.randomUUID();
  const messageId = crypto.randomUUID();

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO wall_messages (id, message, author, is_anonymous, created_at, status, payment_id) VALUES (?, ?, ?, ?, ?, 'pending', ?)"
    ).bind(
      messageId,
      payload.message,
      payload.author,
      payload.isAnonymous ? 1 : 0,
      createdAt,
      paymentId
    ),
    env.DB.prepare(
      "INSERT INTO payments (id, message_id, expected_amount, token, network, recipient_address, status, created_at, expires_at) VALUES (?, ?, ?, 'USDT', 'TRON', ?, 'pending', ?, ?)"
    ).bind(
      paymentId,
      messageId,
      EXPECTED_AMOUNT_BASE_UNITS,
      env.WALL_RECEIVING_ADDRESS,
      createdAt,
      expiresAt
    ),
  ]);

  return success(
    {
      paymentId,
      messageId,
      amount: '1',
      amountBaseUnits: EXPECTED_AMOUNT_BASE_UNITS,
      token: 'USDT',
      network: 'TRON',
      recipientAddress: env.WALL_RECEIVING_ADDRESS,
      expiresAt,
    },
    201
  );
};

const verifyPayment = async (request: Request, env: Env, paymentId: string): Promise<Response> => {
  validatePaymentId(paymentId);
  const body = await parseJson(request);
  if (
    typeof body.transactionHash !== 'string' ||
    !TRANSACTION_HASH_PATTERN.test(body.transactionHash)
  ) {
    throw new ApiError(
      'invalid_transaction_hash',
      'transactionHash must be a 64-character hexadecimal hash.',
      400
    );
  }
  const transactionHash = body.transactionHash.toLowerCase();
  const payment = await getPayment(env.DB, paymentId);
  if (!payment) throw new ApiError('payment_not_found', 'Payment not found.', 404);
  if (payment.status !== 'pending') {
    throw new ApiError('payment_not_pending', 'Payment is no longer pending.', 409);
  }

  const checkedAt = isoNow();
  if (new Date(payment.expires_at).getTime() <= Date.now()) {
    await markAttempt(env.DB, paymentId, checkedAt, 'expired');
    throw new ApiError('payment_expired', 'This payment has expired.', 410);
  }

  const existingTransaction = await env.DB.prepare(
    'SELECT id FROM payments WHERE transaction_hash = ?'
  )
    .bind(transactionHash)
    .first<{ id: string }>();
  if (existingTransaction && existingTransaction.id !== paymentId) {
    throw new ApiError('duplicate_transaction', 'This transaction has already been used.', 409);
  }

  const verification = await new TronService(env).verifyTransaction(transactionHash);
  if (!verification.ok) {
    const detail = failureDetails[verification.reason];
    await markAttempt(
      env.DB,
      paymentId,
      checkedAt,
      detail.invalid ? 'invalid' : undefined,
      transactionHash
    );
    throw new ApiError(detail.code, detail.message, 422);
  }

  const confirmedAt = isoNow();
  try {
    // D1 batch is transactional. Each message-state mutation is gated by payment confirmation,
    // and the partial unique index rejects a second active wall message.
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE payments SET status = 'confirmed', transaction_hash = ?, sender_address = ?, confirmed_at = ?, last_checked_at = ?, verification_attempts = verification_attempts + 1 WHERE id = ? AND status = 'pending' AND expires_at > ?"
      ).bind(
        transactionHash,
        verification.senderAddress,
        confirmedAt,
        checkedAt,
        paymentId,
        confirmedAt
      ),
      env.DB.prepare(
        "UPDATE wall_messages SET status = 'overwritten', overwritten_at = ? WHERE status = 'active' AND EXISTS (SELECT 1 FROM payments WHERE id = ? AND status = 'confirmed')"
      ).bind(confirmedAt, paymentId),
      env.DB.prepare(
        "UPDATE wall_messages SET status = 'active' WHERE id = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM payments WHERE id = ? AND status = 'confirmed')"
      ).bind(payment.message_id, paymentId),
    ]);
  } catch {
    // A unique transaction hash or active-message race is intentionally reported without exposing D1 details.
    throw new ApiError(
      'confirmation_conflict',
      'The payment could not be confirmed. Please refresh its status.',
      409
    );
  }

  const confirmedPayment = await getPayment(env.DB, paymentId);
  if (!confirmedPayment || confirmedPayment.status !== 'confirmed') {
    throw new ApiError(
      'confirmation_conflict',
      'The payment could not be confirmed. Please refresh its status.',
      409
    );
  }
  const message = await getMessage(env.DB, payment.message_id);
  return success({
    payment: paymentResponse(confirmedPayment),
    message: message ? messageResponse(message) : null,
  });
};

const getWall = async (env: Env): Promise<Response> => {
  const message = await env.DB.prepare(
    "SELECT * FROM wall_messages WHERE status = 'active' LIMIT 1"
  ).first<MessageRow>();
  return success(message ? messageResponse(message) : null);
};

const getGraveyard = async (env: Env): Promise<Response> => {
  const result = await env.DB.prepare(
    "SELECT * FROM wall_messages WHERE status = 'overwritten' ORDER BY overwritten_at DESC"
  ).all<MessageRow>();
  return success((result.results ?? []).map(messageResponse));
};

const getHallOfFame = async (env: Env): Promise<Response> => {
  const result = await env.DB.prepare(
    "SELECT *, CAST((julianday(overwritten_at) - julianday(created_at)) * 86400 AS INTEGER) AS survival_seconds FROM wall_messages WHERE status = 'overwritten' ORDER BY survival_seconds DESC, overwritten_at DESC LIMIT 100"
  ).all<MessageRow & { survival_seconds: number }>();
  return success(
    (result.results ?? []).map((message) => ({
      ...messageResponse(message),
      survivalSeconds: message.survival_seconds,
    }))
  );
};

const getMessageOfTheWeek = async (env: Env): Promise<Response> => {
  const result = await env.DB.prepare(
    "SELECT *, CAST((julianday(overwritten_at) - julianday(created_at)) * 86400 AS INTEGER) AS survival_seconds FROM wall_messages WHERE status = 'overwritten' AND overwritten_at >= datetime('now', '-7 days') ORDER BY survival_seconds DESC, overwritten_at DESC LIMIT 1"
  ).first<MessageRow & { survival_seconds: number }>();
  return success(
    result ? { ...messageResponse(result), survivalSeconds: result.survival_seconds } : null
  );
};

export const createWorker = () => ({
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsed = (response: Response) => withCors(response, request, env);
    if (request.method === 'OPTIONS') return corsed(new Response(null, { status: 204 }));

    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/api/health') {
        return corsed(success({ status: 'ok' }));
      }
      if (request.method === 'GET' && url.pathname === '/api/wall')
        return corsed(await getWall(env));
      if (request.method === 'POST' && url.pathname === '/api/overwrites') {
        return corsed(await createOverwrite(request, env));
      }
      if (request.method === 'GET' && url.pathname === '/api/graveyard')
        return corsed(await getGraveyard(env));
      if (request.method === 'GET' && url.pathname === '/api/hall-of-fame') {
        return corsed(await getHallOfFame(env));
      }
      if (request.method === 'GET' && url.pathname === '/api/message-of-the-week') {
        return corsed(await getMessageOfTheWeek(env));
      }

      const paymentMatch = url.pathname.match(/^\/api\/payments\/([^/]+)$/);
      if (request.method === 'GET' && paymentMatch) {
        validatePaymentId(paymentMatch[1]);
        const payment = await getCurrentPayment(env.DB, paymentMatch[1]);
        if (!payment) return corsed(failure('payment_not_found', 'Payment not found.', 404));
        return corsed(success(paymentResponse(payment)));
      }
      const verifyMatch = url.pathname.match(/^\/api\/payments\/([^/]+)\/verify$/);
      if (request.method === 'POST' && verifyMatch) {
        return corsed(await verifyPayment(request, env, verifyMatch[1]));
      }
      return corsed(failure('not_found', 'Endpoint not found.', 404));
    } catch (error) {
      if (error instanceof ApiError)
        return corsed(failure(error.code, error.message, error.status));
      return corsed(failure('internal_error', 'An unexpected error occurred.', 500));
    }
  },
});

export default createWorker();
