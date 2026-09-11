import { compareCategories } from "./category-priority";
import { displayDetailLabel as label, displayOrganizationType, visibleLogicalMembers } from "./display-formats";
import { buildProcessDisplay } from "./process-display";
import { selectCategoryCapacity, canonicalizeObservations, observationLabel, visibleObservations, displayObservationUnit, displayPrimaryCapacityUnit } from "./observation-display";

type Row = Record<string, unknown>;
const visibleCategory = (value: unknown) => value !== "LANDFILL";
const rows = (d: Row, key: string): Row[] => (Array.isArray(d[key]) ? d[key] as Row[] : [])
  .filter(row => visibleCategory(row.category ?? row.category_type ?? row.source_category));
const e = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
const number = (value: unknown) => typeof value === "number" ? value.toLocaleString("ko-KR", { maximumFractionDigits: 10 }) : value;
const capacity = (m: Row) => m.primary_capacity_value == null ? "—" : `${e(number(m.primary_capacity_value))} ${e(displayPrimaryCapacityUnit(m))}`;
const hiddenOperatorNames = new Set(["민간(대행)", "민간대행", "민간위탁", "위탁", "직영", "민간", "공공", "공기업"]);
const visibleDetailOrganizations = (data: Row[]) => data.filter(row =>
  String(row.relationship_type ?? "").toUpperCase() !== "OPERATOR"
  && !hiddenOperatorNames.has(String(row.organization_name ?? "").replace(/\s+/g, "")));
const table = (data: Row[], columns: [string, string][], category = "UNKNOWN") => `<div class="detail-table"><div>${columns.map(([, title]) => `<b>${title}</b>`).join("")}</div>${data.map(row => `<div>${columns.map(([key]) => `<span${key === "indicator_label" && Array.isArray(row.source_observations) && row.source_observations.length > 1 ? ` title="${e(`원천 항목: ${(row.source_observations as Row[]).map(source => source.metric_key_raw).join(" · ")}`)}"` : ""}>${e(["metric_type", "unit", "capacity_type", "category", "relation_type"].includes(key) ? (key === "unit" ? displayObservationUnit(category, row) : label(row[key])) : key === "organization_type" ? displayOrganizationType(row[key]) : key === "indicator_label" ? observationLabel(row) : key === "observed_year" ? row[key] : number(row[key]))}</span>`).join("")}</div>`).join("")}</div>`;

export interface CategoryDetail {
  category: string;
  members: Row[];
  processes: Row[];
  capacities: Row[];
  observations: Row[];
}

// Source categories take precedence over the physical facility's primary category.
// Keep the original member ID on every row, even when source data describes a
// different category (e.g. sludge flows attached to a sewage facility).
export function assembleCategoryDetails(detail: Row): CategoryDetail[] {
  const members = visibleLogicalMembers(detail.members);
  const groups = new Map<string, CategoryDetail>();
  const group = (category: string) => {
    if (!groups.has(category)) groups.set(category, { category, members: [], processes: [], capacities: [], observations: [] });
    return groups.get(category)!;
  };
  for (const member of members) group(String(member.category ?? "UNKNOWN")).members.push(member);
  for (const category of rows(detail, "categories")) group(String(category.category_type ?? "UNKNOWN"));
  for (const key of ["processes", "capacities", "observations"] as const) {
    for (const row of rows(detail, key)) {
      const member = members.find(m => m.facility_id === row.member_facility_id);
      group(String(row.source_category ?? member?.category ?? "UNKNOWN"))[key].push(row);
    }
  }
  for (const section of groups.values()) section.observations = canonicalizeObservations(section.category, assembleObservations(section.category, section.observations));
  return sortCategoryDetails([...groups.values()].filter(group => visibleCategory(group.category)), rows(detail, "categoryPriority"));
}

// A source record is a whole input row, not an individual measurement. Its
// original column is essential: total discharge and advanced discharge may match.
export function assembleObservations(category: string, observations: Row[]): Row[] {
  const seen = new Set<string>();
  return observations.filter(row => {
    const provenance = row.metric_key_raw || row.observation_id;
    if (!row.source_record_id || !provenance) return true;
    const value = row.value == null || String(row.value).trim() === "" ? row.value : Number(row.value);
    const key = JSON.stringify([category, row.observed_year, row.metric_type,
      Number.isFinite(value) ? value : row.value, String(row.unit ?? "").trim().toUpperCase(),
      row.source_code, row.source_record_id, provenance, row.process_id ?? null]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sortCategoryDetails(groups: CategoryDetail[], priorities: Row[]): CategoryDetail[] {
  return groups.sort((a, b) => compareCategories(a.category, b.category));
}

function categoryCard(detail: Row, selectedCategory?: string): string {
  const groups = assembleCategoryDetails(detail).sort((a,b)=>Number(b.category===selectedCategory)-Number(a.category===selectedCategory));
  const members = visibleLogicalMembers(detail.members);
  const originSections = (group: CategoryDetail) => {
    const ids = [...new Set([...group.processes, ...group.capacities, ...group.observations].map(row => row.member_facility_id))];
    return ids.map(id => {
      const member = members.find(m => m.facility_id === id);
      const processes = group.processes.filter(row => row.member_facility_id === id);
      const capacities = group.capacities.filter(row => row.member_facility_id === id);
      const observations = visibleObservations(group.observations.filter(row => row.member_facility_id === id));
      return `<div class="category-data" data-origin-facility="${e(id)}"><p class="category-origin">자료 연결 시설: ${e(member?.facility_name ?? "미확인")} · ${e(label(member?.category))}</p>${buildProcessDisplay(processes).map(section => `<section class="process-section process-${section.kind}"><h4>${e(section.title)}</h4><div class="process-fields">${section.fields.map(field => `<div><span>${e(field.label)}</span><strong class="${field.multiline ? "multiline" : ""}">${e(field.value)}</strong></div>`).join("")}</div></section>`).join("")}${capacities.length ? `<section><h4>처리 용량</h4>${table(capacities, [["capacity_type", "유형"], ["value", "값"], ["unit", "단위"], ["observed_year", "기준연도"]], group.category)}</section>` : ""}${observations.length ? `<section><h4>연도별 관측값</h4>${table(observations, [["observed_year", "연도"], ["indicator_label", "지표"], ["value", "값"], ["unit", "단위"]], group.category)}</section>` : ""}</div>`;
    }).join("");
  };
  return `<p class="category-summary" aria-label="통합 카테고리">${groups.map(group => e(label(group.category))).join(" · ")}</p><article class="logical-group"><h2>시설 카테고리 <small>구성 시설 ${members.length}개</small></h2>${groups.map(group => `<section class="facility-category${group.category===selectedCategory?" selected-category":""}" data-category="${e(group.category)}"><h3>${e(label(group.category))}${group.category===selectedCategory?" <small>선택한 카테고리</small>":""}</h3>${categoryContextCapacity(detail,group.category)}${group.members.length ? "" : `<span class="logical-member-capacity">${capacity(selectCategoryCapacity(group.category, group.observations, {}))}</span>`}<div class="logical-members">${group.members.map(member => `<div class="logical-member" data-member-facility="${e(member.facility_id)}"><div class="logical-member-title"><b>${e(member.facility_name)}</b>${Number(member.is_master) === 1 ? '<span class="master-badge">대표</span>' : ""}</div><span class="logical-member-address">${e(member.address)}</span><span class="logical-member-capacity">${group.category==="SEWAGE_SLUDGE"?"연간 처리량 ":""}${capacity(selectCategoryCapacity(group.category, group.observations.filter(row=>row.member_facility_id===member.facility_id), member))}</span></div>`).join("")}</div>${originSections(group)}</section>`).join("")}</article>`;
}

export function renderFacilityDetail(detail: Row, selectedCategory?: string): string {
  const original = detail.facility as Row;
  const f = original.facilityType === "LANDFILL" ? { ...original, facilityType: "UNKNOWN", primaryCapacityValue: null } : original;
  const organizations = visibleDetailOrganizations(rows(detail, "organizations"));
  const organizationCard = organizations.length
    ? `<article><h2>운영·관리 기관 <small>${organizations.length}</small></h2>${table(organizations, [["relationship_type", "관계"], ["organization_name", "기관명"], ["organization_type", "기관 유형"]])}</article>`
    : "";
  return `<section class="page facility-detail"><button class="back" data-back>← 검색</button><header><p>${selectedCategory?"선택한 유형":"대표 유형"} · ${e(label(selectFacilityCapacity(detail,selectedCategory).category))}</p><h1>${e(f.name)}</h1><span>${e(f.address)}</span></header><div class="facts"><dl><dt>관할지역</dt><dd>${e(f.jurisdiction ?? "미지정")}</dd><dt>실제 소재지</dt><dd>${e([f.province, f.city, f.district].filter(Boolean).join(" "))}</dd><dt>원본 주소</dt><dd>${e(f.address)}</dd><dt>공공/민간</dt><dd>${e(label(f.publicPrivate ?? "UNKNOWN"))}</dd></dl>${capacitySummaryCard(detail)}</div>${categoryCard(detail,selectedCategory)}${organizationCard}</section>`;
}

function contextCapacity(detail: Row, category: string): Row | undefined {
  const context=rows(detail,"categoryContexts").find(row=>row.category===category);
  return context ? { category,primary_capacity_value:context.capacity_value,
    primary_capacity_unit:context.capacity_unit,primary_capacity_type:context.capacity_type } : undefined;
}

export function categoryCapacitySummary(detail: Row): Row[] {
  const original = detail.facility as Row;
  const f = original.facilityType === "LANDFILL" ? { ...original, facilityType: "UNKNOWN", primaryCapacityValue: null } : original;
  const allContexts = rows(detail, "categoryContexts");
  const representative = String([...allContexts].sort((a, b) =>
    compareCategories(String(a.category), String(b.category)))[0]?.category ?? (visibleCategory(f.facilityType) ? f.facilityType : "UNKNOWN") ?? "UNKNOWN");
  const contexts = allContexts.filter(row => row.capacity_value != null)
    .sort((a, b) => Number(b.category === representative) - Number(a.category === representative)
      || compareCategories(String(a.category), String(b.category)));
  return contexts.map(row => ({ ...contextCapacity(detail, String(row.category)),
    is_representative: row.category === representative }));
}

function capacitySummaryCard(detail: Row): string {
  const summary = categoryCapacitySummary(detail);
  return `<dl class="capacity-summary"><dt>처리용량</dt><dd>${summary.length
    ? `<div class="capacity-summary-list">${summary.map(row => `<div class="capacity-summary-row"><span>${e(label(row.category))}</span><strong>${capacity(row)}</strong>${row.is_representative ? '<mark class="primary-capacity-chip">대표용량</mark>' : ""}</div>`).join("")}</div>`
    : '<span class="capacity-summary-empty">등록된 설계용량이 없습니다.</span>'}</dd></dl>`;
}
function categoryContextCapacity(detail: Row, category: string): string {
  const context=contextCapacity(detail,category);
  return context ? `<p class="category-design-capacity">처리용량 <strong>${capacity(context)}</strong></p>` : "";
}
export function selectFacilityCapacity(detail: Row, selectedCategory?: string): Row {
  const selected=selectedCategory ? contextCapacity(detail,selectedCategory) : undefined;
  if(selected)return selected;
  const original = detail.facility as Row;
  const f = original.facilityType === "LANDFILL" ? { ...original, facilityType: "UNKNOWN", primaryCapacityValue: null } : original;
  const representative = [...rows(detail, "categoryContexts")].sort((a,b)=>compareCategories(String(a.category),String(b.category)))[0];
  if (representative) return contextCapacity(detail,String(representative.category))!;
  const group = assembleCategoryDetails(detail)[0];
  const category = group?.category ?? String(f.facilityType);
  const member = group?.members.find(row => row.facility_id === f.facilityId) ?? group?.members[0];
  const fallback = category === f.facilityType
    ? { primary_capacity_value: f.primaryCapacityValue, primary_capacity_unit: f.primaryCapacityUnit,
        primary_capacity_type: f.primaryCapacityType, category }
    : { ...member, category };
  return selectCategoryCapacity(category,
    group?.observations ?? [], fallback);
}
