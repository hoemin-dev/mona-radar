"""Read-only SQLite backups. No schema migration, no source writes, no overwrites."""
from pathlib import Path
import hashlib
import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {
    "market": Path(r"C:\Users\Manager1\AppData\Local\com.monaradar.market\MonaRadar\Market\mona-radar-market.sqlite3"),
    "forecast": Path(r"D:\work\mona-live\app\db\mona-live-procurement-plan.sqlite"),
    "facility": Path(r"C:\Users\Manager1\AppData\Local\com.monaradar.facility\data\facility.sqlite3"),
    "company": Path(r"D:\mona\Company\mona-radar-company.sqlite3"),
    "certification": Path(r"C:\Users\Manager1\AppData\Local\com.monaradar.certification\data\mona-radar-certification.sqlite"),
    "live_legacy": Path(r"D:\work\mona-live\app\db\mona-live-bid-notice.sqlite"),
}

def digest(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()

def main():
    report = {"createdAt": datetime.now(timezone.utc).isoformat(), "databases": []}
    for domain, source in SOURCES.items():
        destination = ROOT / "db_local" / ("live/legacy" if domain == "live_legacy" else domain) / source.name
        destination.parent.mkdir(parents=True, exist_ok=True)
        before = digest(source)
        source_stat = source.stat()
        copied = not destination.exists()
        if copied:
            temporary = destination.with_suffix(destination.suffix + ".importing")
            with closing(sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)) as original:
                original.execute("PRAGMA query_only=ON")
                with closing(sqlite3.connect(temporary)) as target:
                    original.backup(target, pages=-1)
        after = digest(source)
        if before != after:
            raise RuntimeError(f"Source changed during backup; inspect collector activity: {source}")
        checked_path = temporary if copied else destination
        with closing(sqlite3.connect(checked_path.as_uri() + "?mode=ro", uri=True)) as database:
            check = database.execute("PRAGMA quick_check").fetchone()[0]
            if check != "ok":
                raise RuntimeError(f"Integrity check failed for {domain}: {check}")
            tables = []
            for name, kind, sql in database.execute("SELECT name,type,sql FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall():
                quoted = '"' + name.replace('"', '""') + '"'
                tables.append({"name": name, "kind": kind, "count": database.execute(f"SELECT COUNT(*) FROM {quoted}").fetchone()[0], "columns": [dict(zip(["cid", "name", "type", "notnull", "default", "pk"], row)) for row in database.execute(f"PRAGMA table_info({quoted})")], "sql": sql})
        if copied:
            temporary.rename(destination)
        item = {"domain": domain, "source": str(source), "destination": str(destination.relative_to(ROOT)), "sourceBytes": source_stat.st_size, "sourceSha256": before, "sourceUnchanged": True, "snapshotSha256": digest(destination), "copied": copied, "quickCheck": check, "tables": tables}
        report["databases"].append(item)
        (ROOT / "db_local/import-manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps({"domain": domain, "copied": copied, "bytes": destination.stat().st_size, "tables": {t["name"]: t["count"] for t in tables}}, ensure_ascii=False), flush=True)
    output = ROOT / "db_local/import-manifest.json"
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

if __name__ == "__main__":
    main()
