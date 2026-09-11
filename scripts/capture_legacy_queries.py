"""One-time, reviewable capture of legacy SELECT logic; never imports app startup code."""
from pathlib import Path
import re
import json
import hashlib

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "server/queries"
OUT.mkdir(parents=True, exist_ok=True)
provenance = []

def save(name, source, value):
    (OUT / name).write_text(value, encoding="utf-8")
    provenance.append({"file": name, "source": str(source), "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest()})

facility = Path(r"D:\work\mona-radar-facility\src-tauri\src")
for name in ["category_projection.sql", "category_search.sql"]:
    save(name, facility / "sql" / name, (facility / "sql" / name).read_text(encoding="utf-8"))
source = facility / "lib.rs"
code = source.read_text(encoding="utf-8")
save("facility_where.sql", source, re.search(r'let where_sql="(.*?)";', code, re.S)[1])
source = Path(r"D:\work\mona-radar-certification\src-tauri\src\lib.rs")
code = source.read_text(encoding="utf-8")
save("certification_effective.sql", source, re.search(r'const EFFECTIVE_RECORDS_SQL: &str = "(.*?)";', code, re.S)[1])
source = Path(r"D:\work\mona-radar-market\src-tauri\src\lib.rs")
code = source.read_text(encoding="utf-8")
classification = source.parent / "search_classifications.sql"
save("market_classifications.sql", classification, classification.read_text(encoding="utf-8"))
section = code[code.index('fn search_procurements('):code.index('fn raw_text(')]
for mode, marker in [("integrated", '"integrated"=>"'), ("bid", '"bid"=>"'), ("contract", '_=>"SELECT')]:
    start = section.index(marker) + (len(marker) if mode != "contract" else 4)
    sql = section[start:section.index('"', start)]
    save(f"market_{mode}.sql", source, sql)
awards = code[code.index('fn search_awards('):code.index('fn search_procurements(')]
save("market_award.sql", source, re.search(r'let sql = "(.*?)";', awards, re.S)[1])
(OUT / "provenance.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2), encoding="utf-8")

# Retain the existing Company card and detail rendering, with explicit dependencies.
current = ROOT / "src/main.ts"
code = current.read_text(encoding="utf-8")
cards = code[code.index('const resultCard='):code.index('const searchView=')]
detail = code[code.index('const rows='):code.index('const placeholder=')]
detail = detail.replace('const d=selected!,c=d.company;', 'const c=d.company;')
detail = detail.replace('const detailView=()=>', 'export const companyDetailView=(d:CompanyDetail,favorites:Set<string>)=>')
detail = detail.replace('c.homepageUrl?`', 'safeUrl(c.homepageUrl)?`').replace('esc(c.homepageUrl)', 'esc(safeUrl(c.homepageUrl))')
cards = cards.replace('const resultCard=(row:Company)=>', 'export const companyCard=(row:Company,favorites:Set<string>)=>')
views = ROOT / "src/views"
views.mkdir(exist_ok=True)
(views / "company.ts").write_text('import type { Company, CompanyDetail } from "../types";\nimport { esc, safeUrl } from "../ui";\nconst amount=(value?:number)=>value==null?"—":`${value.toLocaleString()}백만원`;\n' + cards + detail, encoding="utf-8")
print("Captured legacy queries and existing Company views.")
