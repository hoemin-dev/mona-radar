// Vendored from mona-radar-market; see provenance.json.
function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function jsonKind(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
function extractLiveItems(root) {
  const rootRecord = record(root);
  const response = record(rootRecord?.response);
  const body = record(response?.body);
  const items = body?.items;
  if (Array.isArray(items)) return items.map(record).filter((value) => value !== void 0);
  const itemsRecord = record(items);
  const nested = itemsRecord?.item;
  if (Array.isArray(nested)) return nested.map(record).filter((value) => value !== void 0);
  const single = record(nested);
  return single ? [single] : [];
}
function walk(root) {
  const found = [{ path: "$", value: root }];
  const queue = [...found];
  const visited = /* @__PURE__ */ new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    if (current.value === null || typeof current.value !== "object" || visited.has(current.value)) continue;
    visited.add(current.value);
    const entries = Array.isArray(current.value) ? current.value.map((value, index) => [String(index), value]) : Object.entries(current.value);
    for (const [key, value] of entries) {
      const child = { path: `${current.path}.${key}`, value };
      found.push(child);
      if (value !== null && typeof value === "object") queue.push(child);
    }
  }
  return found;
}
function locate(nodes, predicate) {
  return nodes.find((node) => {
    const value = record(node.value);
    return value !== void 0 && predicate(value);
  });
}
function state(value) {
  if (value === void 0) return "missing";
  if (value === null) return "null";
  if (value === "") return "empty";
  if (value === " ") return "single-space";
  if (value === 0) return "zero";
  return "value";
}
function inspectLiveShape(root) {
  const nodes = walk(root);
  const response = nodes.find((node) => node.path.endsWith(".response") && record(node.value));
  const header = locate(nodes, (value) => "resultCode" in value && "resultMsg" in value);
  const paging = locate(nodes, (value) => "pageNo" in value || "numOfRows" in value || "totalCount" in value);
  const body = nodes.find((node) => node.path.endsWith(".body") && record(node.value));
  const items = nodes.find((node) => node.path.endsWith(".items"));
  const nestedItem = nodes.find((node) => node.path.endsWith(".item"));
  const item = nestedItem ?? (items && (Array.isArray(items.value) || items.value === null) ? items : void 0);
  const itemValues = item === void 0 || item.value === null ? [] : Array.isArray(item.value) ? item.value : [item.value];
  const itemRecords = itemValues.map(record).filter((value) => value !== void 0);
  const fields = [...new Set(itemRecords.flatMap((value) => Object.keys(value)))].sort();
  const itemFields = {};
  const itemValueStates = {};
  for (const field of fields) {
    itemFields[field] = [...new Set(itemRecords.filter((row) => field in row).map((row) => jsonKind(row[field])))].sort();
    const counts = {};
    for (const row of itemRecords) {
      const name = state(row[field]);
      counts[name] = (counts[name] ?? 0) + 1;
    }
    itemValueStates[field] = counts;
  }
  const rootRecord = record(root);
  const headerRecord = record(header?.value);
  const pagingRecord = record(paging?.value);
  return {
    rootKind: jsonKind(root),
    rootKeys: Object.keys(rootRecord ?? {}).sort(),
    responsePath: response?.path,
    headerPath: header?.path,
    bodyPath: body?.path,
    itemsPath: items?.path,
    itemPath: item?.path,
    itemKind: item ? jsonKind(item.value) : "missing",
    itemCount: itemRecords.length,
    pagingPath: paging?.path,
    pagingTypes: Object.fromEntries(["pageNo", "numOfRows", "totalCount"].map((key) => [key, key in (pagingRecord ?? {}) ? jsonKind(pagingRecord?.[key]) : "missing"])),
    headerTypes: Object.fromEntries(["resultCode", "resultMsg"].map((key) => [key, key in (headerRecord ?? {}) ? jsonKind(headerRecord?.[key]) : "missing"])),
    itemFields,
    itemValueStates
  };
}
const SENSITIVE_FIELD = /(addr|adrs|email|eml|fax|ofcl|officer|phone|tel|담당|전화|주소|메일)/iu;
function sanitizeLiveFixture(value, serviceKey) {
  const sanitize = (current, key = "") => {
    if (Array.isArray(current)) return current.map((entry) => sanitize(entry, key));
    const currentRecord = record(current);
    if (currentRecord) return Object.fromEntries(Object.entries(currentRecord).map(([name, entry]) => [name, sanitize(entry, name)]));
    if (typeof current !== "string" || current === "") return current;
    if (serviceKey && current.includes(serviceKey)) return current.replaceAll(serviceKey, "[REDACTED]");
    if (/email|eml/iu.test(key)) return "redacted@example.invalid";
    if (/phone|tel|fax/iu.test(key)) return "000-0000-0000";
    if (/addr|adrs|주소/iu.test(key)) return "TEST_ADDRESS";
    if (SENSITIVE_FIELD.test(key)) return "TEST_CONTACT";
    return current;
  };
  return sanitize(value);
}
export {
  extractLiveItems,
  inspectLiveShape,
  jsonKind,
  sanitizeLiveFixture
};
