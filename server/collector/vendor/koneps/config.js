// Vendored from mona-radar-market; see provenance.json.
import { KonepsError } from "./errors.js";
import { loadDevelopmentKonepsEnvironment } from "./environment.js";
const DEFAULT_TIMEOUT_MS = 35e3;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BASE_BACKOFF_MS = 250;
function loadKonepsConfig(env = process.env) {
  if (env === process.env) loadDevelopmentKonepsEnvironment(env);
  const serviceKey = env.KONEPS_SERVICE_KEY?.trim();
  if (!serviceKey) {
    throw new KonepsError("configuration", "KONEPS_SERVICE_KEY is not configured");
  }
  const mode = env.KONEPS_SERVICE_KEY_MODE ?? "preserve";
  if (mode !== "preserve" && mode !== "encode") {
    throw new KonepsError("configuration", "KONEPS_SERVICE_KEY_MODE must be preserve or encode");
  }
  return {
    serviceKey,
    serviceKeyMode: mode,
    // Allow for the recently observed KONEPS latency spikes without an overly broad timeout.
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxRetries: DEFAULT_MAX_RETRIES,
    baseBackoffMs: DEFAULT_BASE_BACKOFF_MS
  };
}
export {
  DEFAULT_BASE_BACKOFF_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  loadKonepsConfig
};
