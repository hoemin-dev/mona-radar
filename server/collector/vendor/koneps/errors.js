// Vendored from mona-radar-market; see provenance.json.
class KonepsError extends Error {
  category;
  metadata;
  constructor(category, message, metadata) {
    super(message);
    this.name = "KonepsError";
    this.category = category;
    this.metadata = metadata;
  }
}
export {
  KonepsError
};
