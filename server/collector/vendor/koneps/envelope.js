// Vendored from mona-radar-market; see provenance.json.
function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function stringValue(value) {
  return typeof value === "string" || typeof value === "number" ? String(value) : void 0;
}
function numberValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return void 0;
}
function findRecord(root, predicate) {
  const queue = [{ value: root, depth: 0 }];
  const visited = /* @__PURE__ */ new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    const record = asRecord(current.value);
    if (!record || visited.has(record)) continue;
    visited.add(record);
    if (predicate(record)) return record;
    if (current.depth >= 5) continue;
    for (const child of Object.values(record)) {
      if (child !== null && typeof child === "object") queue.push({ value: child, depth: current.depth + 1 });
    }
  }
  return void 0;
}
function extractKonepsEnvelope(parsedJson) {
  const header = findRecord(parsedJson, (record) => "resultCode" in record && "resultMsg" in record);
  if (!header) return void 0;
  const resultCode = stringValue(header.resultCode);
  const resultMsg = stringValue(header.resultMsg);
  if (resultCode === void 0 || resultMsg === void 0) return void 0;
  const paging = findRecord(
    parsedJson,
    (record) => "pageNo" in record || "numOfRows" in record || "totalCount" in record
  );
  return {
    resultCode,
    resultMsg,
    pageNo: numberValue(paging?.pageNo),
    numOfRows: numberValue(paging?.numOfRows),
    totalCount: numberValue(paging?.totalCount)
  };
}
export {
  extractKonepsEnvelope
};
