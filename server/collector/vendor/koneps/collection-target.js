// Vendored from mona-radar-market; see provenance.json.
import { classificationName } from "./target-registry.js";
function targetLevel(code) {
  if (/^\d{8}$/.test(code)) return "CLASSIFICATION_8";
  if (/^\d{10}$/.test(code)) return "DETAILED_10";
  throw new Error("INVALID_COLLECTION_TARGET");
}
function collectionTarget(code, name, parentName) {
  const level = targetLevel(code);
  if (level === "CLASSIFICATION_8") name = classificationName(code, name);
  else parentName = classificationName(code, parentName);
  return {
    targetCode: code,
    targetName: name,
    targetLevel: level,
    ...level === "DETAILED_10" ? { parentClassificationNo: code.slice(0, 8), ...parentName ? { parentClassificationName: parentName } : {} } : {}
  };
}
export {
  collectionTarget,
  targetLevel
};
