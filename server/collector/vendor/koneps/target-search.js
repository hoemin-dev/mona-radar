// Vendored from mona-radar-market; see provenance.json.
import { classificationName } from "./target-registry.js";
import { collectionTarget } from "./collection-target.js";
import { KonepsClient } from "./client.js";
import { loadKonepsConfig } from "./config.js";
import { DETAILED_PRODUCT_CLASSIFICATION_SEARCH_OPERATION, CATALOG_ITEM_SEARCH_OPERATION } from "./endpoints.js";
import { matchingFixedTargets } from "./target-registry.js";
function planCollectorTargetSearch(query) {
  const value = query.trim();
  if (!value) throw new Error("\uC138\uBD80\uD488\uBA85 \uB610\uB294 8/10\uC790\uB9AC \uBC88\uD638\uB97C \uC785\uB825\uD558\uC138\uC694.");
  if (/^\d{10}$/u.test(value)) return { kind: "exact", params: { pageNo: 1, numOfRows: 10, dtilPrdctClsfcNoBgnNo: value, dtilPrdctClsfcNoEndNo: value } };
  if (/^\d{8}$/u.test(value)) return { kind: "range", params: { pageNo: 1, numOfRows: 100, dtilPrdctClsfcNoBgnNo: `${value}00`, dtilPrdctClsfcNoEndNo: `${value}99` } };
  if (/^\d+$/u.test(value)) throw new Error("\uBC88\uD638 \uAC80\uC0C9\uC740 8\uC790\uB9AC \uB610\uB294 10\uC790\uB9AC\uC5EC\uC57C \uD569\uB2C8\uB2E4.");
  return { kind: "name", params: { pageNo: 1, numOfRows: 30, dtilPrdctClsfcNoNm: value } };
}
function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
async function searchCollectorTargets(query, client = new KonepsClient({ config: loadKonepsConfig() }), stored = []) {
  const request = planCollectorTargetSearch(query);
  const apiCandidates = [];
  let page = 1, seen = 0, total = 0;
  do {
    const response = await client.request(DETAILED_PRODUCT_CLASSIFICATION_SEARCH_OPERATION, { ...request.params, pageNo: page });
    const items = responseItems(response.parsedJson);
    total = response.envelope.totalCount ?? items.length;
    if (!items.length && seen < total) throw new Error("TARGET_SEARCH_PAGINATION_STALLED");
    for (const value of items) {
      const code = String(value.dtilPrdctClsfcNo ?? "");
      if (!/^\d{10}$/.test(code)) continue;
      apiCandidates.push({
        dtilPrdctClsfcNo: code,
        dtilPrdctClsfcNoNm: String(value.dtilPrdctClsfcNoNm ?? ""),
        useYn: String(value.useYn ?? ""),
        ...String(value.prdctClsfcNo ?? "") === code.slice(0, 8) && value.prdctClsfcNoNm ? { parentClassificationName: String(value.prdctClsfcNoNm) } : {}
      });
    }
    seen += items.length;
    page++;
  } while (seen < total);
  const parents = new Map(stored.filter((t) => t.dtilPrdctClsfcNo.length === 8 && t.dtilPrdctClsfcNoNm).map((t) => [t.dtilPrdctClsfcNo, t.dtilPrdctClsfcNoNm]));
  const local = stored.filter((t) => t.dtilPrdctClsfcNo.includes(query.trim()) || t.dtilPrdctClsfcNoNm.includes(query.trim()) || /^\d{10}$/.test(query.trim()) && t.dtilPrdctClsfcNo === query.trim().slice(0, 8));
  if (!apiCandidates.length && request.kind === "name") {
    const response = await client.request(CATALOG_ITEM_SEARCH_OPERATION, { pageNo: 1, numOfRows: 100, prdctClsfcNoNm: query.trim() });
    for (const row of responseItems(response.parsedJson)) {
      const parent = String(row.prdctClsfcNo ?? ""), name = String(row.prdctClsfcNoNm ?? "");
      if (/^\d{8}$/.test(parent) && name) {
        parents.set(parent, name);
        local.push({ dtilPrdctClsfcNo: parent, dtilPrdctClsfcNoNm: name, useYn: "" });
      }
    }
  }
  for (const candidate of apiCandidates) {
    const parent = candidate.dtilPrdctClsfcNo.slice(0, 8);
    if (candidate.parentClassificationName) {
      parents.set(parent, candidate.parentClassificationName);
      continue;
    }
    if (parents.has(parent)) continue;
    const response = await client.request(CATALOG_ITEM_SEARCH_OPERATION, { pageNo: 1, numOfRows: 1, dtilPrdctClsfcNo: candidate.dtilPrdctClsfcNo });
    for (const row of responseItems(response.parsedJson)) if (String(row.prdctClsfcNo ?? "") === parent && row.prdctClsfcNoNm) parents.set(parent, String(row.prdctClsfcNoNm));
  }
  for (const c of apiCandidates) c.parentClassificationName = parents.get(c.dtilPrdctClsfcNo.slice(0, 8));
  const candidates = mergeCollectorTargetCandidates(query, [...local, ...apiCandidates]);
  return { kind: request.kind, totalCount: candidates.length, candidates };
}
function responseItems(json) {
  const body = record(record(record(json)?.response)?.body), raw = record(body?.items)?.item ?? body?.items;
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((v) => record(v) ? [record(v)] : []);
}
function mergeCollectorTargetCandidates(query, apiCandidates) {
  const candidates = /* @__PURE__ */ new Map();
  for (const target of matchingFixedTargets(query)) candidates.set(target.dtilPrdctClsfcNo, { ...target, useYn: target.status === "historical" ? "\uACFC\uAC70 \uCF54\uB4DC" : "" });
  for (const target of apiCandidates) {
    const previous = candidates.get(target.dtilPrdctClsfcNo);
    const normalized = { ...target, ...target.dtilPrdctClsfcNo.length === 8 ? { dtilPrdctClsfcNoNm: classificationName(target.dtilPrdctClsfcNo, target.dtilPrdctClsfcNoNm) } : { parentClassificationName: classificationName(target.dtilPrdctClsfcNo, target.parentClassificationName) } };
    const merged = { ...previous, ...normalized, parentClassificationName: normalized.parentClassificationName ?? previous?.parentClassificationName };
    candidates.set(target.dtilPrdctClsfcNo, merged.status === "historical" ? { ...merged, useYn: "\uACFC\uAC70 \uCF54\uB4DC" } : merged);
  }
  for (const target of [...candidates.values()]) {
    const code = target.dtilPrdctClsfcNo, parent = code.slice(0, 8), parentName = target.parentClassificationName ?? (candidates.get(parent)?.dtilPrdctClsfcNoNm || void 0);
    candidates.set(code, { ...target, ...collectionTarget(code, target.dtilPrdctClsfcNoNm, parentName) });
    if (code.length === 10 && (!candidates.has(parent) || parentName)) candidates.set(parent, { dtilPrdctClsfcNo: parent, dtilPrdctClsfcNoNm: parentName ?? "", useYn: "", ...collectionTarget(parent, parentName ?? "") });
  }
  return [...candidates.values()].sort((left, right) => left.dtilPrdctClsfcNo.localeCompare(right.dtilPrdctClsfcNo));
}
export {
  mergeCollectorTargetCandidates,
  planCollectorTargetSearch,
  responseItems,
  searchCollectorTargets
};
