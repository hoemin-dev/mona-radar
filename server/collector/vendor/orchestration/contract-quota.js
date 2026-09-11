// Vendored from mona-radar-market; see provenance.json.
class ContractQuotaPaused extends Error {
  constructor(resumeAfter, reason) {
    super(JSON.stringify({ status: "quota_paused", resumeAfter, reason }));
    this.resumeAfter = resumeAfter;
    this.reason = reason;
  }
  resumeAfter;
  reason;
}
function contractQuota(db, now = /* @__PURE__ */ new Date()) {
  const since = new Date(now.getTime() - 864e5).toISOString();
  const calls = db.prepare(`SELECT requested_at, http_status, request_metadata_json FROM api_call
    WHERE service='CntrctInfoService' AND requested_at>? ORDER BY requested_at`).all(since);
  let resumeAfter = 0;
  for (const call of calls) {
    if (call.http_status !== 429) continue;
    const retry = JSON.parse(call.request_metadata_json).responseHeaders?.["retry-after"];
    const at = Date.parse(call.requested_at);
    const reset = typeof retry === "string" && /^\d+$/.test(retry) ? at + Number(retry) * 1e3 : Date.parse(retry ?? "");
    resumeAfter = Math.max(resumeAfter, at + 864e5, Number.isFinite(reset) ? reset : 0);
  }
  const older = db.prepare(`SELECT requested_at, request_metadata_json FROM api_call
    WHERE service='CntrctInfoService' AND http_status=429 AND requested_at<=?`).all(since);
  for (const call of older) {
    const retry = JSON.parse(call.request_metadata_json).responseHeaders?.["retry-after"];
    const reset = typeof retry === "string" && /^\d+$/.test(retry) ? Date.parse(call.requested_at) + Number(retry) * 1e3 : Date.parse(retry ?? "");
    if (Number.isFinite(reset)) resumeAfter = Math.max(resumeAfter, reset);
  }
  if (calls.length >= 950) resumeAfter = Math.max(resumeAfter, Date.parse(calls[calls.length - 950].requested_at) + 864e5);
  return { calls: calls.length, limit: 1e3, reserve: 50, resumeAfter: resumeAfter > now.getTime() ? new Date(resumeAfter).toISOString() : null };
}
function assertContractQuota(db, now = /* @__PURE__ */ new Date()) {
  const quota = contractQuota(db, now);
  if (quota.resumeAfter) throw new ContractQuotaPaused(quota.resumeAfter, "contract_service_budget_or_429");
}
export {
  ContractQuotaPaused,
  assertContractQuota,
  contractQuota
};
