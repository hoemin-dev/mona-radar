import { displayCapacityUnit } from "./display-formats";

export type ProcessRow = {
  process_name?: unknown;
  process_type?: unknown;
  source_record_id?: unknown;
  source_code?: unknown;
  raw_payload?: unknown;
};

export type DisplayField = { label: string; value: string; multiline?: boolean };
export type DisplaySection = {
  kind: "process" | "route" | "target" | "performance";
  title: string;
  sourceCode: string;
  fields: DisplayField[];
  badge?: string;
};

type JsonMap = Record<string, unknown>;

const unitLabels: Record<string, string> = {
  THOUSAND_SM3_PER_YEAR: "천 Sm³/년",
  M3: "㎥",
};

const emptyWords = new Set(["", "-", "해당없음", "해당 없음", "없음", "null", "undefined"]);

export function isMeaningful(value: unknown): boolean {
  if (value == null || value === false || value === 0) return false;
  if (typeof value === "string") {
    const text = value.trim();
    if (emptyWords.has(text.toLowerCase())) return false;
    const numeric = text.replaceAll(",", "");
    if (/^[+-]?(?:0+(?:\.0*)?|\.0+)$/.test(numeric)) return false;
    return true;
  }
  if (Array.isArray(value)) return value.some(isMeaningful);
  if (typeof value === "object") return Object.values(value as JsonMap).some(isMeaningful);
  return true;
}

export function parseJsonPayload(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

function displayScalar(value: unknown): string | null {
  if (!isMeaningful(value)) return null;
  if (Array.isArray(value)) {
    const values = value.map(displayScalar).filter((x): x is string => Boolean(x));
    return values.length ? values.join(", ") : null;
  }
  if (typeof value === "object") {
    const item = value as JsonMap;
    if ("raw" in item || "value_candidate" in item || "unit_candidate" in item) {
      const candidate = isMeaningful(item.value_candidate) ? item.value_candidate : item.raw;
      const shown = displayScalar(candidate);
      if (!shown) return null;
      const unit = isMeaningful(item.unit_candidate) ? displayCapacityUnit(unitLabels[String(item.unit_candidate)] ?? item.unit_candidate) : "";
      return unit ? `${shown} ${unit}` : shown;
    }
    const values = Object.entries(item).map(([key, nested]) => {
      const shown = displayScalar(nested);
      return shown ? `${key}: ${shown}` : null;
    }).filter((x): x is string => Boolean(x));
    return values.length ? values.join(" · ") : null;
  }
  return String(value).trim();
}

function asMap(value: unknown): JsonMap {
  const parsed = parseJsonPayload(value);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonMap : {};
}

function field(payload: JsonMap, key: string, label = key, transform?: (value: string) => string): DisplayField | null {
  const shown = displayScalar(payload[key]);
  if (!shown) return null;
  const value = transform ? transform(shown) : shown;
  return { label, value, multiline: value.includes("\n") || key === "처리공정" };
}

function fields(payload: JsonMap, specs: Array<[string, string?, ((value: string) => string)?]>): DisplayField[] {
  return specs.map(([key, label, transform]) => field(payload, key, label, transform)).filter((x): x is DisplayField => Boolean(x));
}

function sourceSection(sourceCode: string, payload: JsonMap): DisplaySection[] {
  switch (sourceCode) {
    case "SRC_PUBLIC_SEWAGE_2024":
      return section("process", "처리 공정", sourceCode, fields(payload, [["처리방법"], ["적용신기술", "적용 신기술"]]));
    case "SRC_PUBLIC_WASTEWATER_2024":
      return section("process", "처리 공정", sourceCode, fields(payload, [["주처리 공법명"], ["고도처리 공법명"], ["고도처리 시설용량"]]));
    case "SRC_LIVESTOCK_2025":
      return section("process", "처리 공정", sourceCode, fields(payload, [["주처리방식"], ["공법"], ["처리공정"]]));
    case "SRC_FOOD_WASTE_2024":
      return section("process", "처리 공정", sourceCode, fields(payload, [["처리방법", "처리방법", value => value.replace(/^\s*\d+\.\s*/, "")]]));
    case "SRC_SLUDGE_FACILITY_2024":
      return section("process", "처리 공정", sourceCode, fields(payload, [["처리방식"]]));
    case "SRC_SLUDGE_FLOW_2024":
      return sludgeFlow(sourceCode, payload);
    case "SRC_SEPTAGE_2024":
      return section("process", "처리 공정", sourceCode, fields(payload, [["처리공법"], ["연계처리장명"]]));
    case "SRC_PUBLIC_INCINERATION_2023":
      return [
        ...section("process", "처리 공정", sourceCode, fields(payload, [["소각방식"], ["운영방식"]])),
        ...section("target", "처리 대상", sourceCode, fields(payload, [["처분대상 폐기물", "폐기물"]])),
      ];
    case "SRC_BIOGAS_2023":
      return [
        ...section("process", "처리 공정", sourceCode, fields(payload, [["공정"], ["원료/구획"]])),
        ...section("performance", "처리 실적", sourceCode, fields(payload, [["생산량"]])),
      ];
    case "SRC_WATER_TREATMENT_2024":
      return section("process", "처리 공정", sourceCode, fields(payload, [["정수처리방식"]]));
    default: {
      const generic: DisplayField[] = Object.entries(payload).flatMap(([key, value]) => {
        const shown = displayScalar(value);
        return shown ? [{ label: key, value: shown, multiline: shown.includes("\n") }] : [];
      });
      return section("process", "처리 공정", sourceCode, generic);
    }
  }
}

function section(kind: DisplaySection["kind"], title: string, sourceCode: string, value: DisplayField[]): DisplaySection[] {
  return value.length ? [{ kind, title, sourceCode, fields: value }] : [];
}

function sludgeFlow(sourceCode: string, payload: JsonMap): DisplaySection[] {
  const routeFields: DisplayField[] = [];
  for (const [rawKey, rawValue] of Object.entries(payload)) {
    if (!isMeaningful(rawValue) || /_(합계|소계)$/.test(rawKey) || rawKey.startsWith("찌꺼기 발생량_")) continue;
    if (!/^(외부위탁처리량|자체찌꺼기처리량|이송처리량|이송처리장)/.test(rawKey)) continue;
    const shown = displayScalar(rawValue);
    if (!shown) continue;
    const path = rawKey.split("_").map(part => part.replace(" 후 처리(2차)", "").trim());
    let label: string;
    if (rawKey === "이송처리량") label = "이송 → 처리량";
    else if (rawKey === "이송처리장") label = "이송 → 처리장";
    else {
      const root = path.shift()!.replace("자체찌꺼기처리량", "자체 처리").replace("외부위탁처리량", "외부 위탁");
      const first = path.shift();
      const second = path.shift();
      label = [root, first ? `1차 처리: ${first}` : null, second ? `2차 처리: ${second}` : "처리량", ...path]
        .filter((part): part is string => Boolean(part)).join(" → ");
    }
    routeFields.push({ label, value: /시설\(업체명\)$/.test(rawKey) ? shown : `${shown} 톤/년` });
  }
  return section("route", "찌꺼기 처리실적/경로", sourceCode, routeFields);
}

export function buildProcessDisplay(rows: ProcessRow[]): DisplaySection[] {
  const seen = new Set<string>();
  const result: DisplaySection[] = [];
  for (const row of rows) {
    const sourceCode = String(row.source_code ?? "");
    const processJson = typeof row.process_name === "string" ? row.process_name.trim() : JSON.stringify(row.process_name ?? null);
    const dedupeKey = `${String(row.source_record_id ?? "")}\u0000${processJson}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const payload = sourceCode === "SRC_SLUDGE_FLOW_2024" ? asMap(row.raw_payload) : asMap(row.process_name);
    result.push(...sourceSection(sourceCode, payload));
  }
  return result;
}
