// Vendored from mona-radar-market; see provenance.json.
const SECRET_QUERY_NAMES = /* @__PURE__ */ new Set(["servicekey"]);
const REDACTED = "[REDACTED]";
function redactKonepsUrl(input) {
  return input.replace(
    /([?&])([^=&]+)=([^&#]*)/giu,
    (match, separator, name) => SECRET_QUERY_NAMES.has(name.toLowerCase()) ? `${separator}${name}=${REDACTED}` : match
  );
}
function redactSecrets(input, secrets = []) {
  let value = redactKonepsUrl(input);
  for (const secret of secrets) {
    if (secret) value = value.split(secret).join(REDACTED);
  }
  return value;
}
export {
  REDACTED,
  redactKonepsUrl,
  redactSecrets
};
