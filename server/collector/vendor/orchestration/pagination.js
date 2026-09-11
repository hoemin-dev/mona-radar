// Vendored from mona-radar-market; see provenance.json.
function pageGuard(initialTotal) {
  let total = initialTotal;
  const hashes = /* @__PURE__ */ new Set();
  return (reported, count, seen, page, hash) => {
    if (reported !== void 0 && (!Number.isSafeInteger(reported) || reported < 0)) throw new Error("INVALID_TOTAL_COUNT");
    if (total !== void 0 && reported !== void 0 && reported !== total) throw new Error("TOTAL_COUNT_DRIFT");
    total ??= reported ?? count;
    if (count === 0 && seen < total) throw new Error("PAGINATION_STALLED");
    if (hash && count > 0 && hashes.has(hash)) throw new Error("REPEATED_PAGE_RESPONSE");
    if (hash) hashes.add(hash);
    if (page > 1e4) throw new Error("MAX_PAGE_LIMIT_EXCEEDED");
    return total;
  };
}
export {
  pageGuard
};
