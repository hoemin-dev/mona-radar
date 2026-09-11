// Vendored from mona-radar-market; see provenance.json.
import { createHash } from "node:crypto";
import { KONEPS_SERVICE_ENDPOINTS } from "./endpoints.js";
import { KonepsError } from "./errors.js";
import { extractKonepsEnvelope } from "./envelope.js";
import { REDACTED, redactKonepsUrl, redactSecrets } from "./redaction.js";
function diagnosticTarget(params) {
  const values = params;
  return [values.dtilPrdctClsfcNo, values.prdctClsfcNoNm, values.bidNtceNo].find((value) => typeof value === "string" && value.length > 0);
}
function diagnosticMonth(params) {
  const values = params;
  const value = [values.inqryBgnDate, values.inqryBgnDt].find((candidate) => typeof candidate === "string" && /^\d{6}/u.test(candidate));
  return value ? `${value.slice(0, 4)}-${value.slice(4, 6)}` : void 0;
}
function diagnosticLog(event) {
  if (process.env.MARKET_COLLECTOR_DIAGNOSTICS === "1") console.log(JSON.stringify(event));
}
function encodeServiceKey(key, mode) {
  if (/[&#?\s]/u.test(key)) {
    throw new KonepsError("configuration", "KONEPS_SERVICE_KEY contains unsafe query separators");
  }
  return mode === "encode" ? encodeURIComponent(key) : key;
}
function buildRequestUrl(operation, params, config) {
  if (!Number.isInteger(params.pageNo) || params.pageNo < 1) {
    throw new KonepsError("configuration", "pageNo must be a positive integer");
  }
  if (!Number.isInteger(params.numOfRows) || params.numOfRows < 1) {
    throw new KonepsError("configuration", "numOfRows must be a positive integer");
  }
  try {
    operation.validate?.(params);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid operation parameters";
    throw new KonepsError("configuration", redactSecrets(message, [config.serviceKey]));
  }
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (name === "ServiceKey" || value === void 0) continue;
    query.set(name, String(value));
  }
  if (!query.has("type") && operation.defaultResponseType) {
    query.set("type", operation.defaultResponseType);
  }
  const endpoint = KONEPS_SERVICE_ENDPOINTS[operation.service];
  const path = operation.path.replace(/^\/+|\/+$/gu, "");
  const encodedKey = encodeServiceKey(config.serviceKey, config.serviceKeyMode);
  return `${endpoint}/${path}?${query.toString()}&ServiceKey=${encodedKey}`;
}
function safeHeaders(headers) {
  return Object.freeze(Object.fromEntries(headers.entries()));
}
function shouldRetryStatus(status) {
  return status === 429 || status >= 500;
}
function defaultSleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
class KonepsClient {
  #config;
  #fetch;
  #sleep;
  #random;
  #now;
  #pacer;
  #rateLimitRetryDelaysMs;
  #onRateLimitRetry;
  #requestCount = 0;
  #retryCount = 0;
  constructor(options) {
    this.#config = options.config;
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#sleep = options.sleep ?? defaultSleep;
    this.#random = options.random ?? Math.random;
    this.#now = options.now ?? (() => /* @__PURE__ */ new Date());
    this.#pacer = options.pacer;
    this.#rateLimitRetryDelaysMs = options.rateLimitRetryDelaysMs;
    this.#onRateLimitRetry = options.onRateLimitRetry;
  }
  get counters() {
    return { requestCount: this.#requestCount, retryCount: this.#retryCount };
  }
  async request(operation, params) {
    const url = buildRequestUrl(operation, params, this.#config);
    const redactedUrl = redactKonepsUrl(url);
    const started = this.#now();
    let attemptCount = 0;
    const metadata = (finished, values = {}) => ({
      service: operation.service,
      operation: operation.path,
      redactedUrl,
      pageNo: params.pageNo,
      numOfRows: params.numOfRows,
      startedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
      durationMs: Math.max(0, finished.getTime() - started.getTime()),
      attemptCount,
      retryCount: Math.max(0, attemptCount - 1),
      ...values
    });
    while (true) {
      await this.#pacer?.beforeAttempt();
      attemptCount += 1;
      this.#requestCount += 1;
      const attemptStarted = this.#now();
      diagnosticLog({
        type: "KONEPS_REQUEST_START",
        collector: process.env.MARKET_COLLECTOR_KIND ?? "probe",
        phase: "request",
        endpoint: `${KONEPS_SERVICE_ENDPOINTS[operation.service]}/${operation.path}`,
        month: diagnosticMonth(params),
        target: diagnosticTarget(params),
        databasePath: process.env.MARKET_DB_PATH,
        cwd: process.cwd(),
        timeoutMs: this.#config.timeoutMs,
        attempt: attemptCount,
        serviceKeyPresent: this.#config.serviceKey.length > 0,
        serviceKeyLength: this.#config.serviceKey.length,
        serviceKeyHashPrefix: createHash("sha256").update(this.#config.serviceKey).digest("hex").slice(0, 8)
      });
      const controller = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, this.#config.timeoutMs);
      try {
        const response = await this.#fetch(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal
        });
        clearTimeout(timeout);
        if (!response.ok) {
          if (operation.service !== "CntrctInfoService" && response.status === 429 && this.#rateLimitRetryDelaysMs) {
            const retryIndex = attemptCount - 1;
            const waitMs = this.#rateLimitRetryDelaysMs[retryIndex];
            if (waitMs !== void 0) {
              this.#retryCount += 1;
              this.#onRateLimitRetry?.({ attempt: retryIndex + 1, waitSeconds: waitMs / 1e3, operation: operation.path });
              if (this.#pacer?.imposeCooldown) {
                this.#pacer.imposeCooldown(waitMs);
              } else {
                await this.#sleep(waitMs);
              }
              continue;
            }
          }
          if (operation.service !== "CntrctInfoService" && shouldRetryStatus(response.status) && attemptCount <= this.#config.maxRetries) {
            await this.#backoff(attemptCount);
            continue;
          }
          const finished2 = this.#now();
          throw new KonepsError(
            "http",
            `KONEPS HTTP request failed with status ${response.status}`,
            metadata(finished2, { httpStatus: response.status, responseHeaders: Object.fromEntries(["retry-after", "date", "x-ratelimit-reset", "ratelimit-reset", "content-type"].flatMap((name) => {
              const value = response.headers.get(name);
              return value === null ? [] : [[name, redactSecrets(value, [this.#config.serviceKey])]];
            })), responseBody: redactSecrets(await response.text(), [this.#config.serviceKey]) })
          );
        }
        const buffer = await response.arrayBuffer();
        const bodyBytes = new Uint8Array(buffer);
        const bodyText = new TextDecoder("utf-8").decode(bodyBytes);
        let parsedJson;
        try {
          parsedJson = JSON.parse(bodyText);
        } catch {
          const finished2 = this.#now();
          throw new KonepsError(
            "parse",
            "KONEPS response was not valid JSON",
            metadata(finished2, { httpStatus: response.status })
          );
        }
        const envelope = extractKonepsEnvelope(parsedJson);
        if (!envelope) {
          const finished2 = this.#now();
          throw new KonepsError(
            "structure",
            "KONEPS response did not contain the documented common envelope",
            metadata(finished2, { httpStatus: response.status })
          );
        }
        const finished = this.#now();
        const callMetadata = metadata(finished, {
          httpStatus: response.status,
          resultCode: envelope.resultCode,
          resultMsg: redactSecrets(envelope.resultMsg, [this.#config.serviceKey])
        });
        if (envelope.resultCode !== "00") {
          throw new KonepsError(
            "api",
            `KONEPS API returned resultCode ${envelope.resultCode}`,
            callMetadata
          );
        }
        return {
          status: response.status,
          headers: safeHeaders(response.headers),
          bodyBytes,
          bodyText,
          parsedJson,
          envelope,
          receivedAt: finished.toISOString(),
          durationMs: callMetadata.durationMs,
          metadata: callMetadata
        };
      } catch (error) {
        clearTimeout(timeout);
        if (error instanceof KonepsError) throw error;
        const category = timedOut || error instanceof DOMException && error.name === "AbortError" ? "timeout" : "network";
        diagnosticLog({
          type: "KONEPS_REQUEST_FAILURE",
          collector: process.env.MARKET_COLLECTOR_KIND ?? "probe",
          phase: category,
          endpoint: `${KONEPS_SERVICE_ENDPOINTS[operation.service]}/${operation.path}`,
          month: diagnosticMonth(params),
          target: diagnosticTarget(params),
          attempt: attemptCount,
          elapsedMs: Math.max(0, this.#now().getTime() - attemptStarted.getTime())
        });
        if (operation.service !== "CntrctInfoService" && attemptCount <= this.#config.maxRetries) {
          await this.#backoff(attemptCount);
          continue;
        }
        const finished = this.#now();
        throw new KonepsError(
          category,
          category === "timeout" ? "KONEPS request timed out" : "KONEPS network request failed",
          metadata(finished)
        );
      }
    }
    throw new KonepsError("network", `Unreachable KONEPS client state ${REDACTED}`);
  }
  async #backoff(failedAttempt) {
    this.#retryCount += 1;
    const exponential = this.#config.baseBackoffMs * 2 ** (failedAttempt - 1);
    const jitter = Math.floor(exponential * 0.25 * this.#random());
    await this.#sleep(exponential + jitter);
  }
}
export {
  KonepsClient
};
