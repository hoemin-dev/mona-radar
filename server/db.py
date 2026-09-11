from pathlib import Path
from contextlib import contextmanager
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "market": "market/mona-radar-market.sqlite3",
    "forecast": "forecast/mona-live-procurement-plan.sqlite",
    "facility": "facility/facility.sqlite3",
    "company": "company/mona-radar-company.sqlite3",
    "certification": "certification/mona-radar-certification.sqlite",
}

@contextmanager
def connect(domain):
    path = ROOT / "db_local" / FILES[domain]
    if not path.is_file():
        raise FileNotFoundError(f"{domain} DB가 없습니다. npm run db:import를 실행하세요.")
    connection = sqlite3.connect(path.as_uri() + "?mode=ro", uri=True, timeout=5)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only=ON")
    try:
        yield connection
    finally:
        connection.close()

def rows(db, sql, params=()):
    return [dict(row) for row in db.execute(sql, params)]

def query_file(name):
    return (ROOT / "server/queries" / name).read_text(encoding="utf-8").strip()

def integer(value, default=1, maximum=1000000):
    return min(maximum, max(1, int(value or default)))

def paginate(db, sql, params, page, size, count_sql=None):
    total = db.execute(count_sql or f"SELECT COUNT(*) FROM ({sql})", params).fetchone()[0]
    pages = max(1, (total + size - 1) // size)
    page = min(integer(page), pages)
    return {"rows": rows(db, sql + " LIMIT ? OFFSET ?", [*params, size, (page - 1) * size]), "total": total, "page": page, "pageSize": size, "totalPages": pages, "countKind": "exact"}

def camel(row):
    return {key.split('_')[0] + ''.join(part.title() for part in key.split('_')[1:]): value for key, value in row.items()}
