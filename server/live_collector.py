"""Isolated Node collector bridge; only MIDWAY's db_local copies are writable."""
from datetime import datetime, timedelta, timezone
from contextlib import closing
import json
import os
import re
import sqlite3
import subprocess
import time
from .db import ROOT, FILES

MODES = ('bid', 'forecast', 'award', 'contract')


def environment():
    values = {}
    path = ROOT / '.env'
    if path.exists():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                key, value = line.split('=', 1)
                if key.strip().startswith('KONEPS_'):
                    values[key.strip()] = value.strip().strip('\"').strip("'")
    values.update({key: value for key, value in os.environ.items() if key.startswith('KONEPS_')})
    return values


def validate_targets(values):
    if not isinstance(values, list) or not 1 <= len(values) <= 50:
        raise ValueError('감시 Target을 1~50개 지정하세요.')
    result = {}
    for value in values:
        if not isinstance(value, dict) or not re.fullmatch(r'[0-9]{10}', str(value.get('code', ''))):
            raise ValueError('세부품명번호는 숫자 10자리입니다.')
        code = value['code']
        name = str(value.get('name', '')).strip()
        if len(name) > 100:
            raise ValueError('Target 이름은 100자 이내로 입력하세요.')
        result[code] = {'code': code, 'name': name or code}
    return sorted(result.values(), key=lambda row: row['code'])


def initial_targets():
    """Migrate the imported mona-live target list, once; no source-app access."""
    legacy = ROOT / 'db_local/live/legacy/mona-live-bid-notice.sqlite'
    if legacy.exists():
        with closing(sqlite3.connect(legacy.as_uri() + '?mode=ro', uri=True)) as db:
            values = [{'code': code, 'name': name} for code, name in db.execute('SELECT dtil_prdct_clsfc_no,display_name FROM live_scan_target WHERE enabled=1')]
            if values:
                return validate_targets(values)
    path = ROOT / 'db_local' / FILES['market']
    if path.exists():
        with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)) as db:
            values = [{'code': code, 'name': name} for code, name in db.execute('SELECT target_code,target_name FROM collection_target WHERE length(target_code)=10')]
            if values:
                return validate_targets(values)
    return []


def backup_before_collection(domain):
    source = ROOT / 'db_local' / FILES[domain]
    backup = ROOT / 'db_local/live/backups' / (domain + '-before-external-scan.sqlite')
    if backup.exists():
        return
    backup.parent.mkdir(parents=True, exist_ok=True)
    temporary = backup.with_suffix('.tmp')
    with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as reader:
        with closing(sqlite3.connect(temporary)) as writer:
            reader.backup(writer)
            if writer.execute('PRAGMA quick_check').fetchone()[0] != 'ok':
                raise RuntimeError('수집 전 DB 백업 검증에 실패했습니다.')
    temporary.replace(backup)


class ExternalCollector:
    def __call__(self, mode, checkpoint, targets, until, stop):
        settings = environment()
        if not (settings.get('KONEPS_SERVICE_KEY') or settings.get('KONEPS_API_KEY')):
            raise RuntimeError('프로젝트 .env에 KONEPS_SERVICE_KEY가 없습니다.')
        validate_targets(targets)
        end = datetime.fromisoformat(until)
        baseline = datetime.fromisoformat(checkpoint) if checkpoint else end - timedelta(hours=24)
        since = min(baseline, end) - timedelta(minutes=10)
        backup_before_collection('forecast' if mode == 'forecast' else 'market')
        runtime = os.environ.copy()
        runtime.update(settings)
        runtime.pop('MARKET_COLLECTOR_DIAGNOSTICS', None)
        command = [os.environ.get('MIDWAY_NODE', 'node'), str(ROOT / 'server/collector/scan.mjs')]
        request = json.dumps({'mode': mode, 'since': since.isoformat(), 'until': until, 'targets': targets})
        child = subprocess.Popen(command, cwd=ROOT, env=runtime, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                 text=True, encoding='utf-8', creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        deadline = time.monotonic() + 1200
        try:
            first = True
            while True:
                if stop.is_set():
                    raise RuntimeError('서버 종료로 수집이 중단되었습니다. 다음 검사에서 재시도합니다.')
                if time.monotonic() > deadline:
                    raise RuntimeError('수집 제한시간 20분을 초과했습니다. 다음 검사에서 재시도합니다.')
                try:
                    output, _ = child.communicate(request if first else None, timeout=1)
                    break
                except subprocess.TimeoutExpired:
                    first = False
            records = []
            for line in output.splitlines():
                try:
                    value = json.loads(line)
                    if isinstance(value, dict): records.append(value)
                except json.JSONDecodeError:
                    pass
            result = next((r for r in reversed(records) if r.get('type') in ['result', 'error']), None)
            if child.returncode or not result or result['type'] == 'error':
                raise RuntimeError(result.get('error', '수집 프로세스가 실패했습니다.') if result else '수집 프로세스가 실패했습니다. Node.js 22.13 이상과 DB 스키마를 확인하세요.')
            return result
        finally:
            if child.poll() is None:
                child.kill()
                child.communicate()
