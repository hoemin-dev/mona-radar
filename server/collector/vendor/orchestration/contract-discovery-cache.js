// Vendored from mona-radar-market; see provenance.json.
import { CONTRACT_SEARCH_OPERATION } from "../koneps/endpoints.js";
function storedContractDiscovery(db, name, range) {
  const date = (s) => s.slice(0, 10).replaceAll("-", "");
  const calls = db.prepare(`SELECT call_id id,operation_run_id run,page_no page,total_count total,actual_item_count count
 FROM api_call WHERE operation=? AND status='succeeded' AND parse_status='succeeded'
 AND json_extract(request_metadata_json,'$.prdctClsfcNoNm')=?
 AND json_extract(request_metadata_json,'$.inqryBgnDate')=? AND json_extract(request_metadata_json,'$.inqryEndDate')=?
 ORDER BY requested_at DESC`).all(CONTRACT_SEARCH_OPERATION.path, name, date(range.start), date(range.end));
  for (const run of new Set(calls.map((c) => c.run))) {
    const pages = /* @__PURE__ */ new Map();
    for (const c of calls.filter((c2) => c2.run === run)) if (!pages.has(c.page)) pages.set(c.page, c);
    const ordered = [...pages.values()].sort((a, b) => a.page - b.page), total = ordered[0]?.total;
    if (total === void 0 || ordered.some((c, i) => c.page !== i + 1 || c.total !== total) || ordered.reduce((n, c) => n + c.count, 0) !== total) continue;
    const ids = ordered.flatMap((c) => db.prepare("SELECT raw_item_id id FROM raw_item_observation WHERE call_id=? ORDER BY item_ordinal").all(c.id).map((r) => r.id));
    if (ids.length === total) return { rawItemIds: ids, total, sourceOperationRunId: run };
  }
  return void 0;
}
export {
  storedContractDiscovery
};
