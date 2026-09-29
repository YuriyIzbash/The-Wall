var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/src/http.ts
var json = /* @__PURE__ */ __name((body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", ...headers }
}), "json");
var success = /* @__PURE__ */ __name((data, status = 200, headers) => json({ success: true, data }, status, headers), "success");
var failure = /* @__PURE__ */ __name((code, message, status, headers) => json({ success: false, error: { code, message } }, status, headers), "failure");
var localhostOrigin = /* @__PURE__ */ __name((origin) => /^http:\/\/localhost(?::\d+)?$/.test(origin), "localhostOrigin");
var corsHeaders = /* @__PURE__ */ __name((request, env) => {
  const origin = request.headers.get("origin");
  const allowed = origin === env.FRONTEND_ORIGIN || origin !== null && localhostOrigin(env.FRONTEND_ORIGIN) && localhostOrigin(origin);
  if (!allowed) return { vary: "Origin" };
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type",
    vary: "Origin"
  };
}, "corsHeaders");
var withCors = /* @__PURE__ */ __name((response, request, env) => {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders(request, env))) {
    headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
}, "withCors");

// worker/src/index.ts
var MESSAGE_MAX_LENGTH = 100;
var AUTHOR_MAX_LENGTH = 50;
var CONTRIBUTION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var networkDefinitions = [
  { id: "bsc", name: "BNB Smart Chain (BSC)", address: /* @__PURE__ */ __name((env) => env.PAYMENT_BSC_ADDRESS, "address") },
  { id: "ethereum", name: "Ethereum", address: /* @__PURE__ */ __name((env) => env.PAYMENT_ETHEREUM_ADDRESS, "address") },
  { id: "tron", name: "TRON", address: /* @__PURE__ */ __name((env) => env.PAYMENT_TRON_ADDRESS, "address") },
  { id: "polygon", name: "Polygon", address: /* @__PURE__ */ __name((env) => env.PAYMENT_POLYGON_ADDRESS, "address") },
  { id: "solana", name: "Solana", address: /* @__PURE__ */ __name((env) => env.PAYMENT_SOLANA_ADDRESS, "address") },
  { id: "ton", name: "TON", address: /* @__PURE__ */ __name((env) => env.PAYMENT_TON_ADDRESS, "address") }
];
var ApiError = class extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
  code;
  status;
  static {
    __name(this, "ApiError");
  }
};
var isoNow = /* @__PURE__ */ __name(() => (/* @__PURE__ */ new Date()).toISOString(), "isoNow");
var configuredNetworks = /* @__PURE__ */ __name((env) => {
  const networks = networkDefinitions.map(({ id, name, address }) => ({
    id,
    name,
    address: address(env).trim()
  }));
  if (networks.some((network) => !network.address)) {
    throw new ApiError(
      "configuration_error",
      "Contribution receiving addresses are not configured correctly.",
      500
    );
  }
  return networks;
}, "configuredNetworks");
var networkById = /* @__PURE__ */ __name((env, networkId) => {
  const network = configuredNetworks(env).find(({ id }) => id === networkId);
  if (!network) throw new ApiError("invalid_network", "Choose a supported network.", 400);
  return network;
}, "networkById");
var contributionResponse = /* @__PURE__ */ __name((contribution, env) => ({
  id: contribution.id,
  messageId: contribution.message_id,
  requestedAmount: contribution.requested_amount,
  token: contribution.token,
  network: contribution.network,
  recipientAddress: contribution.recipient_address,
  createdAt: contribution.created_at,
  networks: configuredNetworks(env)
}), "contributionResponse");
var messageResponse = /* @__PURE__ */ __name((message) => ({
  id: message.id,
  message: message.message,
  author: message.is_anonymous === 1 ? null : message.author,
  isAnonymous: message.is_anonymous === 1,
  font: message.font,
  color: message.color,
  createdAt: message.created_at,
  overwrittenAt: message.overwritten_at,
  status: message.status,
  contributionId: message.contribution_id
}), "messageResponse");
var getContribution = /* @__PURE__ */ __name((db, contributionId) => db.prepare("SELECT * FROM contribution_requests WHERE id = ?").bind(contributionId).first(), "getContribution");
var getMessage = /* @__PURE__ */ __name((db, messageId) => db.prepare("SELECT * FROM wall_messages WHERE id = ?").bind(messageId).first(), "getMessage");
var parseJson = /* @__PURE__ */ __name(async (request) => {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError("invalid_content_type", "Content-Type must be application/json.", 415);
  }
  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new ApiError("invalid_json", "Request body must be valid JSON.", 400);
  }
}, "parseJson");
var requiredString = /* @__PURE__ */ __name((value, name, maximumLength) => {
  if (typeof value !== "string") throw new ApiError("invalid_input", `${name} must be a string.`, 400);
  const normalized = value.trim();
  if (!normalized) throw new ApiError("invalid_input", `${name} is required.`, 400);
  if (normalized.length > maximumLength) {
    throw new ApiError("invalid_input", `${name} must not exceed ${maximumLength} characters.`, 400);
  }
  return normalized;
}, "requiredString");
var validateOverwrite = /* @__PURE__ */ __name((body) => {
  const message = requiredString(body.message, "message", MESSAGE_MAX_LENGTH);
  if (typeof body.isAnonymous !== "boolean") {
    throw new ApiError("invalid_input", "isAnonymous must be a boolean.", 400);
  }
  const isAnonymous = body.isAnonymous;
  if (isAnonymous) return { message, isAnonymous, author: null };
  return { message, isAnonymous, author: requiredString(body.author, "author", AUTHOR_MAX_LENGTH) };
}, "validateOverwrite");
var validateContributionId = /* @__PURE__ */ __name((contributionId) => {
  if (!CONTRIBUTION_ID_PATTERN.test(contributionId)) {
    throw new ApiError("invalid_contribution_id", "Contribution ID is malformed.", 400);
  }
}, "validateContributionId");
var parseNetwork = /* @__PURE__ */ __name((value) => {
  if (typeof value !== "string") throw new ApiError("invalid_network", "Choose a supported network.", 400);
  const match = networkDefinitions.find(({ id }) => id === value);
  if (!match) throw new ApiError("invalid_network", "Choose a supported network.", 400);
  return match.id;
}, "parseNetwork");
var createOverwrite = /* @__PURE__ */ __name(async (request, env) => {
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
    ).bind(contributionId, messageId, defaultNetwork.id, defaultNetwork.address, createdAt)
  ]);
  return success(
    {
      contribution: {
        id: contributionId,
        messageId,
        requestedAmount: "1",
        token: "USDT",
        network: defaultNetwork.id,
        recipientAddress: defaultNetwork.address,
        createdAt,
        networks
      }
    },
    201
  );
}, "createOverwrite");
var continueContribution = /* @__PURE__ */ __name(async (request, env, contributionId) => {
  validateContributionId(contributionId);
  const { network: requestedNetwork } = await parseJson(request);
  const network = networkById(env, parseNetwork(requestedNetwork));
  const contribution = await getContribution(env.DB, contributionId);
  if (!contribution) throw new ApiError("contribution_not_found", "Contribution request not found.", 404);
  const message = await getMessage(env.DB, contribution.message_id);
  if (!message) throw new ApiError("message_not_found", "Overwrite not found.", 404);
  if (message.status === "active") {
    return success({
      contribution: contributionResponse(contribution, env),
      message: messageResponse(message)
    });
  }
  if (message.status !== "pending") {
    throw new ApiError("overwrite_unavailable", "This overwrite is no longer available.", 409);
  }
  const publishedAt = isoNow();
  try {
    await env.DB.batch([
      env.DB.prepare("UPDATE contribution_requests SET network = ?, recipient_address = ? WHERE id = ?").bind(
        network.id,
        network.address,
        contributionId
      ),
      env.DB.prepare(
        "UPDATE wall_messages SET status = 'overwritten', overwritten_at = ? WHERE status = 'active'"
      ).bind(publishedAt),
      env.DB.prepare("UPDATE wall_messages SET status = 'active' WHERE id = ? AND status = 'pending'").bind(
        message.id
      )
    ]);
  } catch {
    throw new ApiError("publication_conflict", "The overwrite could not be published. Please try again.", 409);
  }
  const publishedMessage = await getMessage(env.DB, message.id);
  const selectedContribution = await getContribution(env.DB, contributionId);
  if (!publishedMessage || publishedMessage.status !== "active" || !selectedContribution) {
    throw new ApiError("publication_conflict", "The overwrite could not be published. Please try again.", 409);
  }
  return success({
    contribution: contributionResponse(selectedContribution, env),
    message: messageResponse(publishedMessage)
  });
}, "continueContribution");
var getWall = /* @__PURE__ */ __name(async (env) => {
  const message = await env.DB.prepare(
    "SELECT * FROM wall_messages WHERE status = 'active' LIMIT 1"
  ).first();
  return success(message ? messageResponse(message) : null);
}, "getWall");
var getGraveyard = /* @__PURE__ */ __name(async (env) => {
  const result = await env.DB.prepare(
    "SELECT * FROM wall_messages WHERE status = 'overwritten' ORDER BY overwritten_at DESC"
  ).all();
  return success((result.results ?? []).map(messageResponse));
}, "getGraveyard");
var getHallOfFame = /* @__PURE__ */ __name(async (env) => {
  const result = await env.DB.prepare(
    "SELECT *, CAST((julianday(overwritten_at) - julianday(created_at)) * 86400 AS INTEGER) AS survival_seconds FROM wall_messages WHERE status = 'overwritten' ORDER BY survival_seconds DESC, overwritten_at DESC LIMIT 100"
  ).all();
  return success(
    (result.results ?? []).map((message) => ({
      ...messageResponse(message),
      survivalSeconds: message.survival_seconds
    }))
  );
}, "getHallOfFame");
var getMessageOfTheWeek = /* @__PURE__ */ __name(async (env) => {
  const result = await env.DB.prepare(
    "SELECT *, CAST((julianday(overwritten_at) - julianday(created_at)) * 86400 AS INTEGER) AS survival_seconds FROM wall_messages WHERE status = 'overwritten' AND overwritten_at >= datetime('now', '-7 days') ORDER BY survival_seconds DESC, overwritten_at DESC LIMIT 1"
  ).first();
  return success(
    result ? { ...messageResponse(result), survivalSeconds: result.survival_seconds } : null
  );
}, "getMessageOfTheWeek");
var createWorker = /* @__PURE__ */ __name(() => ({
  async fetch(request, env) {
    const corsed = /* @__PURE__ */ __name((response) => withCors(response, request, env), "corsed");
    if (request.method === "OPTIONS") return corsed(new Response(null, { status: 204 }));
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/api/health") return corsed(success({ status: "ok" }));
      if (request.method === "GET" && url.pathname === "/api/wall") return corsed(await getWall(env));
      if (request.method === "POST" && url.pathname === "/api/overwrites") {
        return corsed(await createOverwrite(request, env));
      }
      if (request.method === "GET" && url.pathname === "/api/graveyard") return corsed(await getGraveyard(env));
      if (request.method === "GET" && url.pathname === "/api/hall-of-fame") {
        return corsed(await getHallOfFame(env));
      }
      if (request.method === "GET" && url.pathname === "/api/message-of-the-week") {
        return corsed(await getMessageOfTheWeek(env));
      }
      const continueMatch = url.pathname.match(/^\/api\/contributions\/([^/]+)\/continue$/);
      if (request.method === "POST" && continueMatch) {
        return corsed(await continueContribution(request, env, continueMatch[1]));
      }
      return corsed(failure("not_found", "Endpoint not found.", 404));
    } catch (error) {
      if (error instanceof ApiError) return corsed(failure(error.code, error.message, error.status));
      return corsed(failure("internal_error", "An unexpected error occurred.", 500));
    }
  }
}), "createWorker");
var src_default = createWorker();

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-Or7iDD/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-Or7iDD/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  createWorker,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
