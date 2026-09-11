// Vendored from mona-radar-market; see provenance.json.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
const KONEPS_ENV_NAMES = /* @__PURE__ */ new Set(["KONEPS_SERVICE_KEY", "KONEPS_SERVICE_KEY_MODE"]);
function projectRoot(start) {
  let current = start;
  for (let depth = 0; depth < 4; depth += 1) {
    const packagePath = join(current, "package.json");
    if (existsSync(packagePath)) {
      try {
        const parsed = JSON.parse(readFileSync(packagePath, "utf8"));
        if (parsed.name === "mona-radar-market") return current;
      } catch {
        return void 0;
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return void 0;
}
function unquote(value) {
  const trimmed = value.trim();
  const first = trimmed[0];
  return trimmed.length >= 2 && (first === '"' || first === "'") && trimmed.at(-1) === first ? trimmed.slice(1, -1) : trimmed;
}
function loadDevelopmentKonepsEnvironment(env = process.env, cwd = process.cwd()) {
  const root = env.MARKET_PROJECT_ROOT ? projectRoot(env.MARKET_PROJECT_ROOT) : projectRoot(cwd);
  if (!root) return;
  const path = join(root, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/u)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/u.exec(line);
    if (!match || !KONEPS_ENV_NAMES.has(match[1])) continue;
    const name = match[1];
    if (env[name] !== void 0) continue;
    const value = unquote(match[2]);
    if (value) env[name] = value;
  }
}
export {
  loadDevelopmentKonepsEnvironment
};
