import { failure, success, withCors } from './http';
import type { ContributionNetwork, ContributionRow, D1Database, Env, MessageRow } from './types';

const MESSAGE_MAX_LENGTH = 100;
const AUTHOR_MAX_LENGTH = 50;
const CONTRIBUTION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const networkDefinitions: ReadonlyArray<{
  id: ContributionNetwork;
  name: string;
  address: (env: Env) => string;
}> = [
  { id: 'bsc', name: 'BNB Smart Chain (BSC)', address: (env) => env.PAYMENT_BSC_ADDRESS },
  { id: 'ethereum', name: 'Ethereum', address: (env) => env.PAYMENT_ETHEREUM_ADDRESS },
  { id: 'tron', name: 'TRON', address: (env) => env.PAYMENT_TRON_ADDRESS },
  { id: 'polygon', name: 'Polygon', address: (env) => env.PAYMENT_POLYGON_ADDRESS },
  { id: 'solana', name: 'Solana', address: (env) => env.PAYMENT_SOLANA_ADDRESS },
  { id: 'ton', name: 'TON', address: (env) => env.PAYMENT_TON_ADDRESS },
];

class ApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

const isoNow = (): string => new Date().toISOString();

const configuredNetworks = (env: Env) => {
  const networks = networkDefinitions.map(({ id, name, address }) => ({
    id,
    name,
    address: address(env).trim(),
  }));
  if (networks.some((network) => !network.address)) {
    throw new ApiError(
      'configuration_error',
      'Contribution receiving addresses are not configured correctly.',
      500
    );
  }
  return networks;
};

const networkById = (env: Env, networkId: ContributionNetwork) => {
  const network = configuredNetworks(env).find(({ id }) => id === networkId);
  if (!network) throw new ApiError('invalid_network', 'Choose a supported network.', 400);
  return network;
};

const contributionResponse = (contribution: ContributionRow, env: Env) => ({
  id: contribution.id,
  messageId: contribution.message_id,
  requestedAmount: contribution.requested_amount,
  token: contribution.token,
  network: contribution.network,
  recipientAddress: contribution.recipient_address,
  createdAt: contribution.created_at,
  networks: configuredNetworks(env),
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
  contributionId: message.contribution_id,
});

const getContribution = (db: D1Database, contributionId: string) =>
  db
    .prepare('SELECT * FROM contribution_requests WHERE id = ?')
    .bind(contributionId)
    .first<ContributionRow>();

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
  if (typeof value !== 'string') throw new ApiError('invalid_input', `${name} must be a string.`, 400);
  const normalized = value.trim();
  if (!normalized) throw new ApiError('invalid_input', `${name} is required.`, 400);
  if (normalized.length > maximumLength) {
    throw new ApiError('invalid_input', `${name} must not exceed ${maximumLength} characters.`, 400);
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

const validateContributionId = (contributionId: string): void => {
  if (!CONTRIBUTION_ID_PATTERN.test(contributionId)) {
    throw new ApiError('invalid_contribution_id', 'Contribution ID is malformed.', 400);
  }
};

const parseNetwork = (value: unknown): ContributionNetwork => {
  if (typeof value !== 'string') throw new ApiError('invalid_network', 'Choose a supported network.', 400);
  const match = networkDefinitions.find(({ id }) => id === value);
  if (!match) throw new ApiError('invalid_network', 'Choose a supported network.', 400);
  return match.id;
};

const createOverwrite = async (request: Request, env: Env): Promise<Response> => {
  const payload = validateOverwrite(await parseJson(request));
  const networks = configuredNetworks(env);
  const defaultNetwork = networks[0];
  const createdAt = isoNow();
  const contributionId = crypto.randomUUID();
  const messageId = crypto.randomUUID();

  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO wall_messages (id, message, author, is_anonymous, created_at, status, contribution_id) VALUES (?, ?, ?, ?, ?, 'pending', ?)"
    ).bind(messageId, payload.message, payload.author, payload.isAnonymous ? 1 : 0, createdAt, contributionId),
    env.DB.prepare(
      "INSERT INTO contribution_requests (id, message_id, requested_amount, token, network, recipient_address, created_at) VALUES (?, ?, '1', 'USDT', ?, ?, ?)"
    ).bind(contributionId, messageId, defaultNetwork.id, defaultNetwork.address, createdAt),
  ]);

  return success(
    {
      contribution: {
        id: contributionId,
        messageId,
        requestedAmount: '1',
        token: 'USDT',
        network: defaultNetwork.id,
        recipientAddress: defaultNetwork.address,
        createdAt,
        networks,
      },
    },
    201
  );
};

const continueContribution = async (
  request: Request,
  env: Env,
  contributionId: string
): Promise<Response> => {
  validateContributionId(contributionId);
  const { network: requestedNetwork } = await parseJson(request);
  const network = networkById(env, parseNetwork(requestedNetwork));
  const contribution = await getContribution(env.DB, contributionId);
  if (!contribution) throw new ApiError('contribution_not_found', 'Contribution request not found.', 404);
  const message = await getMessage(env.DB, contribution.message_id);
  if (!message) throw new ApiError('message_not_found', 'Overwrite not found.', 404);

  if (message.status === 'active') {
    return success({
      contribution: contributionResponse(contribution, env),
      message: messageResponse(message),
    });
  }
  if (message.status !== 'pending') {
    throw new ApiError('overwrite_unavailable', 'This overwrite is no longer available.', 409);
  }

  const publishedAt = isoNow();
  try {
    await env.DB.batch([
      env.DB.prepare('UPDATE contribution_requests SET network = ?, recipient_address = ? WHERE id = ?').bind(
        network.id,
        network.address,
        contributionId
      ),
      env.DB.prepare(
        "UPDATE wall_messages SET status = 'overwritten', overwritten_at = ? WHERE status = 'active'"
      ).bind(publishedAt),
      env.DB.prepare("UPDATE wall_messages SET status = 'active' WHERE id = ? AND status = 'pending'").bind(
        message.id
      ),
    ]);
  } catch {
    throw new ApiError('publication_conflict', 'The overwrite could not be published. Please try again.', 409);
  }

  const publishedMessage = await getMessage(env.DB, message.id);
  const selectedContribution = await getContribution(env.DB, contributionId);
  if (!publishedMessage || publishedMessage.status !== 'active' || !selectedContribution) {
    throw new ApiError('publication_conflict', 'The overwrite could not be published. Please try again.', 409);
  }
  return success({
    contribution: contributionResponse(selectedContribution, env),
    message: messageResponse(publishedMessage),
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
      if (request.method === 'GET' && url.pathname === '/api/health') return corsed(success({ status: 'ok' }));
      if (request.method === 'GET' && url.pathname === '/api/wall') return corsed(await getWall(env));
      if (request.method === 'POST' && url.pathname === '/api/overwrites') {
        return corsed(await createOverwrite(request, env));
      }
      if (request.method === 'GET' && url.pathname === '/api/graveyard') return corsed(await getGraveyard(env));
      if (request.method === 'GET' && url.pathname === '/api/hall-of-fame') {
        return corsed(await getHallOfFame(env));
      }
      if (request.method === 'GET' && url.pathname === '/api/message-of-the-week') {
        return corsed(await getMessageOfTheWeek(env));
      }

      const continueMatch = url.pathname.match(/^\/api\/contributions\/([^/]+)\/continue$/);
      if (request.method === 'POST' && continueMatch) {
        return corsed(await continueContribution(request, env, continueMatch[1]));
      }
      return corsed(failure('not_found', 'Endpoint not found.', 404));
    } catch (error) {
      if (error instanceof ApiError) return corsed(failure(error.code, error.message, error.status));
      return corsed(failure('internal_error', 'An unexpected error occurred.', 500));
    }
  },
});

export default createWorker();
