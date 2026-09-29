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

// worker/src/services/tron.ts
var USDT_DECIMALS = 6;
var MINIMUM_USDT_BASE_UNITS = 1000000n;
var asRecord = /* @__PURE__ */ __name((value) => typeof value === "object" && value !== null && !Array.isArray(value) ? value : null, "asRecord");
var firstString = /* @__PURE__ */ __name((...values) => {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}, "firstString");
var isSuccessful = /* @__PURE__ */ __name((payload) => {
  if (payload.revert === true) return false;
  const contractResult = firstString(payload.contractRet, payload.contract_ret);
  if (contractResult !== null) return contractResult === "SUCCESS";
  const ret = Array.isArray(payload.ret) ? asRecord(payload.ret[0]) : null;
  const returnResult = firstString(ret?.contractRet, ret?.contract_ret);
  if (returnResult !== null) return returnResult === "SUCCESS";
  return payload.success === true;
}, "isSuccessful");
var asRecords = /* @__PURE__ */ __name((value) => {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const record2 = asRecord(item);
      return record2 ? [record2] : [];
    });
  }
  const record = asRecord(value);
  return record ? [record] : [];
}, "asRecords");
var transferCandidates = /* @__PURE__ */ __name((payload) => [
  // TRONSCAN documents these two fields as arrays.
  ...asRecords(payload.trc20TransferInfo),
  ...asRecords(payload.trc20_transfer_info),
  // Older/single-transfer responses expose the same element schema as an object.
  ...asRecords(payload.tokenTransferInfo),
  ...asRecords(payload.token_transfer_info)
], "transferCandidates");
var transferRecipient = /* @__PURE__ */ __name((transfer) => firstString(transfer.to_address, transfer.toAddress, transfer.to), "transferRecipient");
var optionalValue = /* @__PURE__ */ __name((...values) => values.find((value) => value !== void 0 && value !== null), "optionalValue");
var successfulTransferStatus = /* @__PURE__ */ __name((status) => status === void 0 || status === null || status === 0 || status === "0" || status === "SUCCESS" || status === "success", "successfulTransferStatus");
var validTrc20Type = /* @__PURE__ */ __name((tokenType) => tokenType === void 0 || tokenType === null || typeof tokenType === "string" && tokenType.toLowerCase() === "trc20", "validTrc20Type");
var validUsdtDecimals = /* @__PURE__ */ __name((decimals) => decimals === void 0 || decimals === null || decimals === USDT_DECIMALS || decimals === "6", "validUsdtDecimals");
var TronService = class {
  constructor(env, fetcher = fetch) {
    this.env = env;
    this.fetcher = fetcher;
  }
  env;
  fetcher;
  static {
    __name(this, "TronService");
  }
  async verifyTransaction(transactionHash) {
    const url = new URL(this.env.TRONSCAN_API_URL);
    url.searchParams.set("hash", transactionHash);
    let response;
    try {
      response = await this.fetcher(url, {
        headers: { "TRON-PRO-API-KEY": this.env.TRONSCAN_API_KEY }
      });
    } catch {
      return { ok: false, reason: "transaction_not_found" };
    }
    if (!response.ok) return { ok: false, reason: "transaction_not_found" };
    const payload = asRecord(await response.json().catch(() => null));
    if (!payload || Object.keys(payload).length === 0)
      return { ok: false, reason: "transaction_not_found" };
    if (!isSuccessful(payload)) return { ok: false, reason: "transaction_failed" };
    const transfers = transferCandidates(payload);
    if (transfers.length === 0) return { ok: false, reason: "missing_transfer" };
    const matchingRecipient = transfers.filter(
      (transfer) => transferRecipient(transfer) === this.env.WALL_RECEIVING_ADDRESS
    );
    if (matchingRecipient.length === 0) {
      const hasRecipient = transfers.some((transfer) => transferRecipient(transfer) !== null);
      return { ok: false, reason: hasRecipient ? "wrong_recipient" : "missing_transfer" };
    }
    let failure2 = "missing_transfer";
    for (const transfer of matchingRecipient) {
      const tokenInfo = asRecord(transfer.tokenInfo) ?? asRecord(transfer.token_info);
      const tokenName = firstString(
        transfer.symbol,
        transfer.token_symbol,
        tokenInfo?.tokenAbbr,
        tokenInfo?.symbol,
        transfer.tokenName,
        transfer.token_name
      );
      if (tokenName !== "USDT") {
        failure2 = "wrong_token";
        continue;
      }
      const contract = firstString(
        transfer.contract_address,
        transfer.contractAddress,
        transfer.token_address,
        tokenInfo?.tokenId,
        tokenInfo?.address
      );
      if (contract !== this.env.USDT_CONTRACT_ADDRESS) {
        failure2 = "wrong_contract";
        continue;
      }
      const tokenType = optionalValue(
        transfer.tokenType,
        transfer.token_type,
        transfer.tokenType2,
        tokenInfo?.tokenType,
        tokenInfo?.token_type
      );
      if (!validTrc20Type(tokenType)) {
        failure2 = "missing_transfer";
        continue;
      }
      const transferKind = optionalValue(transfer.type, transfer.transfer_type);
      if (transferKind !== void 0 && transferKind !== null && (typeof transferKind !== "string" || transferKind.toLowerCase() !== "transfer")) {
        failure2 = "missing_transfer";
        continue;
      }
      const decimals = optionalValue(
        transfer.decimals,
        transfer.tokenDecimal,
        transfer.token_decimal,
        tokenInfo?.tokenDecimal,
        tokenInfo?.decimals
      );
      if (!validUsdtDecimals(decimals)) {
        failure2 = "wrong_token";
        continue;
      }
      const status = optionalValue(transfer.status, transfer.transfer_status);
      if (!successfulTransferStatus(status)) {
        failure2 = "transaction_failed";
        continue;
      }
      const amount = firstString(transfer.amount_str, transfer.amount, transfer.quant);
      if (!amount || !/^\d+$/.test(amount) || BigInt(amount) < MINIMUM_USDT_BASE_UNITS) {
        failure2 = "insufficient_amount";
        continue;
      }
      return {
        ok: true,
        senderAddress: firstString(transfer.from_address, transfer.fromAddress, transfer.from),
        amountBaseUnits: amount
      };
    }
    return { ok: false, reason: failure2 };
  }
};

// worker/src/index.ts
var MESSAGE_MAX_LENGTH = 100;
var AUTHOR_MAX_LENGTH = 50;
var TRANSACTION_HASH_PATTERN = /^[a-fA-F0-9]{64}$/;
var PAYMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var EXPECTED_AMOUNT_BASE_UNITS = "1000000";
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
var paymentResponse = /* @__PURE__ */ __name((payment) => ({
  id: payment.id,
  messageId: payment.message_id,
  amount: "1",
  amountBaseUnits: payment.expected_amount,
  token: payment.token,
  network: payment.network,
  recipientAddress: payment.recipient_address,
  transactionHash: payment.transaction_hash,
  senderAddress: payment.sender_address,
  status: payment.status,
  createdAt: payment.created_at,
  expiresAt: payment.expires_at,
  confirmedAt: payment.confirmed_at
}), "paymentResponse");
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
  paymentId: message.payment_id
}), "messageResponse");
var getPayment = /* @__PURE__ */ __name((db, paymentId) => db.prepare("SELECT * FROM payments WHERE id = ?").bind(paymentId).first(), "getPayment");
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
  if (typeof value !== "string") {
    throw new ApiError("invalid_input", `${name} must be a string.`, 400);
  }
  const normalized = value.trim();
  if (!normalized) throw new ApiError("invalid_input", `${name} is required.`, 400);
  if (normalized.length > maximumLength) {
    throw new ApiError(
      "invalid_input",
      `${name} must not exceed ${maximumLength} characters.`,
      400
    );
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
var validatePaymentId = /* @__PURE__ */ __name((paymentId) => {
  if (!PAYMENT_ID_PATTERN.test(paymentId)) {
    throw new ApiError("invalid_payment_id", "paymentId is malformed.", 400);
  }
}, "validatePaymentId");
var failureDetails = {
  transaction_not_found: {
    code: "transaction_not_found",
    message: "The transaction could not be found yet.",
    invalid: false
  },
  transaction_failed: {
    code: "transaction_failed",
    message: "The transaction did not succeed on TRON.",
    invalid: true
  },
  missing_transfer: {
    code: "missing_transfer",
    message: "The transaction does not contain a supported TRC-20 transfer.",
    invalid: true
  },
  wrong_token: { code: "wrong_token", message: "The transfer token is not USDT.", invalid: true },
  wrong_contract: {
    code: "wrong_contract",
    message: "The transfer did not use the configured USDT contract.",
    invalid: true
  },
  wrong_recipient: {
    code: "wrong_recipient",
    message: "The transfer was not sent to the Wall receiving address.",
    invalid: true
  },
  insufficient_amount: {
    code: "insufficient_amount",
    message: "The transfer amount is below 1 USDT.",
    invalid: true
  }
};
var markAttempt = /* @__PURE__ */ __name(async (db, paymentId, checkedAt, status, transactionHash) => {
  if (status) {
    await db.prepare(
      "UPDATE payments SET verification_attempts = verification_attempts + 1, last_checked_at = ?, status = ?, transaction_hash = COALESCE(transaction_hash, ?) WHERE id = ? AND status = 'pending'"
    ).bind(checkedAt, status, transactionHash ?? null, paymentId).run();
    return;
  }
  await db.prepare(
    "UPDATE payments SET verification_attempts = verification_attempts + 1, last_checked_at = ? WHERE id = ? AND status = 'pending'"
  ).bind(checkedAt, paymentId).run();
}, "markAttempt");
var createOverwrite = /* @__PURE__ */ __name(async (request, env) => {
  const payload = validateOverwrite(await parseJson(request));
  const now = /* @__PURE__ */ new Date();
  const createdAt = now.toISOString();
  const minutes = Number.parseInt(env.PAYMENT_EXPIRATION_MINUTES, 10);
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 24 * 60) {
    throw new ApiError(
      "configuration_error",
      "Payment expiration is not configured correctly.",
      500
    );
  }
  const expiresAt = new Date(now.getTime() + minutes * 6e4).toISOString();
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
    )
  ]);
  return success(
    {
      paymentId,
      messageId,
      amount: "1",
      amountBaseUnits: EXPECTED_AMOUNT_BASE_UNITS,
      token: "USDT",
      network: "TRON",
      recipientAddress: env.WALL_RECEIVING_ADDRESS,
      expiresAt
    },
    201
  );
}, "createOverwrite");
var verifyPayment = /* @__PURE__ */ __name(async (request, env, paymentId) => {
  validatePaymentId(paymentId);
  const body = await parseJson(request);
  if (typeof body.transactionHash !== "string" || !TRANSACTION_HASH_PATTERN.test(body.transactionHash)) {
    throw new ApiError(
      "invalid_transaction_hash",
      "transactionHash must be a 64-character hexadecimal hash.",
      400
    );
  }
  const transactionHash = body.transactionHash.toLowerCase();
  const payment = await getPayment(env.DB, paymentId);
  if (!payment) throw new ApiError("payment_not_found", "Payment not found.", 404);
  if (payment.status !== "pending") {
    throw new ApiError("payment_not_pending", "Payment is no longer pending.", 409);
  }
  const checkedAt = isoNow();
  if (new Date(payment.expires_at).getTime() <= Date.now()) {
    await markAttempt(env.DB, paymentId, checkedAt, "expired");
    throw new ApiError("payment_expired", "This payment has expired.", 410);
  }
  const existingTransaction = await env.DB.prepare(
    "SELECT id FROM payments WHERE transaction_hash = ?"
  ).bind(transactionHash).first();
  if (existingTransaction && existingTransaction.id !== paymentId) {
    throw new ApiError("duplicate_transaction", "This transaction has already been used.", 409);
  }
  const verification = await new TronService(env).verifyTransaction(transactionHash);
  if (!verification.ok) {
    const detail = failureDetails[verification.reason];
    await markAttempt(
      env.DB,
      paymentId,
      checkedAt,
      detail.invalid ? "invalid" : void 0,
      transactionHash
    );
    throw new ApiError(detail.code, detail.message, 422);
  }
  const confirmedAt = isoNow();
  try {
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
      ).bind(payment.message_id, paymentId)
    ]);
  } catch {
    throw new ApiError(
      "confirmation_conflict",
      "The payment could not be confirmed. Please refresh its status.",
      409
    );
  }
  const confirmedPayment = await getPayment(env.DB, paymentId);
  if (!confirmedPayment || confirmedPayment.status !== "confirmed") {
    throw new ApiError(
      "confirmation_conflict",
      "The payment could not be confirmed. Please refresh its status.",
      409
    );
  }
  const message = await getMessage(env.DB, payment.message_id);
  return success({
    payment: paymentResponse(confirmedPayment),
    message: message ? messageResponse(message) : null
  });
}, "verifyPayment");
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
      if (request.method === "GET" && url.pathname === "/api/health") {
        return corsed(success({ status: "ok" }));
      }
      if (request.method === "GET" && url.pathname === "/api/wall")
        return corsed(await getWall(env));
      if (request.method === "POST" && url.pathname === "/api/overwrites") {
        return corsed(await createOverwrite(request, env));
      }
      if (request.method === "GET" && url.pathname === "/api/graveyard")
        return corsed(await getGraveyard(env));
      if (request.method === "GET" && url.pathname === "/api/hall-of-fame") {
        return corsed(await getHallOfFame(env));
      }
      if (request.method === "GET" && url.pathname === "/api/message-of-the-week") {
        return corsed(await getMessageOfTheWeek(env));
      }
      const paymentMatch = url.pathname.match(/^\/api\/payments\/([^/]+)$/);
      if (request.method === "GET" && paymentMatch) {
        validatePaymentId(paymentMatch[1]);
        const payment = await getPayment(env.DB, paymentMatch[1]);
        if (!payment) return corsed(failure("payment_not_found", "Payment not found.", 404));
        return corsed(success(paymentResponse(payment)));
      }
      const verifyMatch = url.pathname.match(/^\/api\/payments\/([^/]+)\/verify$/);
      if (request.method === "POST" && verifyMatch) {
        return corsed(await verifyPayment(request, env, verifyMatch[1]));
      }
      return corsed(failure("not_found", "Endpoint not found.", 404));
    } catch (error) {
      if (error instanceof ApiError)
        return corsed(failure(error.code, error.message, error.status));
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

// .wrangler/tmp/bundle-IxQjav/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-IxQjav/middleware-loader.entry.ts
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
