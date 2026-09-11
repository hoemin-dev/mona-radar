// Vendored from mona-radar-market; see provenance.json.
import { KonepsError } from "../koneps/errors.js";
import { pageGuard } from "./pagination.js";
async function* discoverContractRanges(range, fetchPage, cancelled = () => false, timeoutFallback = false) {
  const day = 864e5;
  const start = Date.parse(range.start.slice(0, 10) + "T00:00:00Z");
  const end = Date.parse(range.end.slice(0, 10) + "T00:00:00Z");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error("INVALID_DISCOVERY_RANGE");
  if (timeoutFallback && (end - start) / day >= 31) throw new Error("CONTRACT_FALLBACK_REQUIRES_MONTH_RANGE");
  const pending = [{ start, end }];
  while (pending.length) {
    if (cancelled()) return;
    const current = pending.shift();
    const dates = { start: new Date(current.start).toISOString().slice(0, 10), end: new Date(current.end).toISOString().slice(0, 10) };
    const guard = pageGuard(), ids = [];
    let page = 1, total = 0, split = false;
    do {
      if (cancelled()) return;
      let saved;
      try {
        saved = await fetchPage(dates, page);
      } catch (error) {
        if (!timeoutFallback || !(error instanceof KonepsError) || error.category !== "timeout" || current.start === current.end) throw error;
        const days = (current.end - current.start) / day + 1;
        const midpoint = current.start + (Math.floor(days / 2) - 1) * day;
        pending.unshift({ start: current.start, end: midpoint }, { start: midpoint + day, end: current.end });
        console.log(JSON.stringify({ type: "CONTRACT_DISCOVERY_TIMEOUT_SPLIT", ...dates, page }));
        split = true;
        break;
      }
      if (saved.total === void 0) throw new Error("CONTRACT_DISCOVERY_TOTAL_REQUIRED");
      total = guard(saved.total, saved.actualItemCount, ids.length, page, saved.responseSha256);
      if (saved.rawItemIds.length !== saved.actualItemCount || ids.length + saved.actualItemCount > total) throw new Error("CONTRACT_DISCOVERY_COUNT_MISMATCH");
      ids.push(...saved.rawItemIds);
      page++;
    } while (ids.length < total);
    if (!split) yield { rawItemIds: ids, total };
  }
}
export {
  discoverContractRanges
};
