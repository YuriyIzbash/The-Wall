import type { Env } from './types';

export const json = (body: unknown, status = 200, headers: HeadersInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });

export const success = (data: unknown, status = 200, headers?: HeadersInit): Response =>
  json({ success: true, data }, status, headers);

export const failure = (
  code: string,
  message: string,
  status: number,
  headers?: HeadersInit
): Response => json({ success: false, error: { code, message } }, status, headers);

const localhostOrigin = (origin: string) => /^http:\/\/localhost(?::\d+)?$/.test(origin);

export const corsHeaders = (request: Request, env: Env): HeadersInit => {
  const origin = request.headers.get('origin');
  const allowed =
    origin === env.FRONTEND_ORIGIN ||
    (origin !== null && localhostOrigin(env.FRONTEND_ORIGIN) && localhostOrigin(origin));
  if (!allowed) return { vary: 'Origin' };

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    vary: 'Origin',
  };
};

export const withCors = (response: Response, request: Request, env: Env): Response => {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders(request, env))) {
    headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
};
