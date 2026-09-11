// Vendored from mona-radar-market; see provenance.json.
import { DETAILED_PRODUCT_CLASSIFICATION_SEARCH_OPERATION } from "./endpoints.js";
import { responseItems } from "./target-search.js";
import { matchingFixedTargets } from "./target-registry.js";
import { targetLevel } from "./collection-target.js";
const queryCache = /* @__PURE__ */ new WeakMap();
async function detailedQueries(code, client) {
  if (targetLevel(code) === "DETAILED_10") return [code];
  const cached = queryCache.get(client)?.get(code);
  if (cached) return cached;
  const codes = new Set(matchingFixedTargets(code).map((t) => t.dtilPrdctClsfcNo));
  let page = 1, seen = 0, total = 0;
  do {
    const response = await client.request(DETAILED_PRODUCT_CLASSIFICATION_SEARCH_OPERATION, {
      pageNo: page,
      numOfRows: 100,
      dtilPrdctClsfcNoBgnNo: `${code}00`,
      dtilPrdctClsfcNoEndNo: `${code}99`
    });
    const items = responseItems(response.parsedJson);
    total = response.envelope.totalCount ?? items.length;
    if (!items.length && seen < total) throw new Error("TARGET_QUERY_PAGINATION_STALLED");
    for (const item of items) {
      const child = String(item.dtilPrdctClsfcNo ?? "");
      if (/^\d{10}$/.test(child) && child.startsWith(code)) codes.add(child);
    }
    seen += items.length;
    page++;
  } while (seen < total);
  if (!codes.size) throw new Error("TARGET_HAS_NO_OFFICIAL_DETAILED_QUERIES");
  const result = [...codes].sort(), cache = queryCache.get(client) ?? /* @__PURE__ */ new Map();
  cache.set(code, result);
  queryCache.set(client, cache);
  return result;
}
export {
  detailedQueries
};
