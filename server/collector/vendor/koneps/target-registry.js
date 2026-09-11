// Vendored from mona-radar-market; see provenance.json.
const FIXED_TARGETS = [
  { dtilPrdctClsfcNo: "4015155300", dtilPrdctClsfcNoNm: "\uC804\uC9C4\uACF5\uB3D9\uD38C\uD504", parentClassificationName: "\uC804\uC9C4\uACF5\uB3D9\uD38C\uD504", status: "historical" },
  { dtilPrdctClsfcNo: "4015155301", dtilPrdctClsfcNoNm: "\uC804\uC9C4\uACF5\uB3D9\uD38C\uD504", parentClassificationName: "\uC804\uC9C4\uACF5\uB3D9\uD38C\uD504", status: "current" }
];
const FIXED_TARGET_CODES = new Set(FIXED_TARGETS.map((target) => target.dtilPrdctClsfcNo));
function matchingFixedTargets(query) {
  const value = query.trim();
  return FIXED_TARGETS.filter(
    (target) => target.dtilPrdctClsfcNo.includes(value) || target.dtilPrdctClsfcNoNm.includes(value)
  );
}
const VERIFIED_CLASSIFICATIONS = Object.freeze({
  "40151553": "\uC804\uC9C4\uACF5\uB3D9\uD38C\uD504",
  "47101525": "\uD0C8\uC218\uBC0F\uBC30\uC218\uC7A5\uCE58"
});
function classificationName(code, fallback) {
  return VERIFIED_CLASSIFICATIONS[code.slice(0, 8)] ?? fallback;
}
export {
  FIXED_TARGETS,
  FIXED_TARGET_CODES,
  VERIFIED_CLASSIFICATIONS,
  classificationName,
  matchingFixedTargets
};
