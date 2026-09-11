// Vendored from mona-radar-market; see provenance.json.
import { classificationName } from "../koneps/target-registry.js";
import { targetLevel } from "../koneps/collection-target.js";
function registerTarget(db, code, name, parentName) {
  if (code.length === 8) name = classificationName(code, name);
  else parentName = classificationName(code, parentName);
  db.prepare(`INSERT INTO collection_target(target_code,target_name,target_level,parent_classification_no,parent_classification_name)
    VALUES(?,?,?,?,?) ON CONFLICT(target_code) DO UPDATE SET target_name=CASE WHEN excluded.target_name<>'' THEN excluded.target_name ELSE collection_target.target_name END,
    parent_classification_name=COALESCE(excluded.parent_classification_name,collection_target.parent_classification_name)`).run(code, name, targetLevel(code), code.length === 10 ? code.slice(0, 8) : null, parentName ?? null);
}
function recordTargetMembership(db, domain, id, code, runId = null) {
  registerTarget(db, code, "");
  db.prepare(`INSERT INTO entity_collection_target(entity_type,entity_id,target_code,collector_type,run_id)
    VALUES(?,?,?,?,?) ON CONFLICT(entity_type,entity_id,target_code) DO UPDATE SET run_id=COALESCE(excluded.run_id,entity_collection_target.run_id)`).run(domain, id, code, domain, runId);
}
export {
  recordTargetMembership,
  registerTarget
};
