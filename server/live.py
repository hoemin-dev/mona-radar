"""External live collection with independent checkpoints and local change detection."""
from datetime import datetime, timezone, timedelta
import hashlib
import json
import sqlite3
import subprocess
import os
import re
from contextlib import closing
from pathlib import Path
from threading import Lock, RLock, Event, Thread
from copy import deepcopy
from .db import ROOT, connect, rows
from . import market, forecast, facility
from .live_collector import ExternalCollector, MODES, initial_targets, validate_targets, environment

def now(): return datetime.now(timezone.utc)
def korean_day(value): return value.astimezone(timezone(timedelta(hours=9))).date().isoformat()

def fingerprints():
    found={}
    with connect('market') as db:
        for mode,table,key in [('bid','bid_notice','bid_notice_id'),('award','award_result','award_result_id'),('contract','contract_result','contract_result_id')]:
            for row in rows(db,f'SELECT t.* FROM {table} t WHERE EXISTS(SELECT 1 FROM entity_collection_target m WHERE m.entity_type=? AND m.entity_id=t.{key})',[mode.upper()]):
                found[f'{mode}:{row[key]}']=row['semantic_row_hash'] or hashlib.sha256(json.dumps(row,sort_keys=True).encode()).hexdigest()
    with connect('forecast') as db:
        for row in rows(db,'SELECT * FROM order_plan'):
            semantic={k:v for k,v in row.items() if k not in ['created_at','updated_at','collected_month','raw_json']}
            semantic['raw']=json.loads(row['raw_json'])
            found[f"forecast:{row['id']}"]=hashlib.sha256(json.dumps(semantic,sort_keys=True).encode()).hexdigest()
    return found

class LiveService:
    def __init__(self,path=None,read=fingerprints,collect=None):
        self.path=Path(path or ROOT/'db_local/live/state.json')
        self.read=read
        self.collect=collect if collect is not None else ExternalCollector() if read is fingerprints else None
        self.lock=RLock(); self.run_lock=Lock(); self.stop=Event()
        self.data={'enabled':True,'intervalMinutes':15,'lastAttempt':None,'lastSuccess':None,'nextScan':None,'state':'ready','error':None,'baseline':None,'events':[],'lastChanges':0,'revision':0,'domains':{},'scanModes':list(MODES)}
        if self.path.exists(): self.data.update(json.loads(self.path.read_text(encoding='utf-8')))
        if 'collectionDay' not in self.data:
            self.data['collectionDay']=korean_day(now())
            self.data['todayCollected']=sum(korean_day(datetime.fromisoformat(e['detectedAt']))==self.data['collectionDay'] for e in self.data['events'])
        if self.data['state']=='running': self.data['state']='interrupted'
        if self.collect:
            if 'targets' not in self.data:self.data['targets']=initial_targets()
            if self.data.get('collectionVersion')!=1:
                # A local detection success is NOT an external API checkpoint.
                self.data.update(collectionVersion=1,baseline=None,lastSuccess=None,domains={})
            for mode in MODES:
                self.data['domains'].setdefault(mode,{'state':'ready','lastSuccess':None,'checkpoint':None,'error':None,'processed':0})
                if self.data['domains'][mode]['state']=='running':self.data['domains'][mode]['state']='interrupted'

        self.catalog_path=self.path.with_name('targets.sqlite3')
        if not self.catalog_path.exists():self.store_targets(self.data.get('targets',[]))
        available={t['code'] for t in self.target_options()}
        self.data['targets']=[t for t in self.data.get('targets',[]) if t['code'] in available]

    def store_targets(self, targets):
        self.catalog_path.parent.mkdir(parents=True,exist_ok=True)
        with closing(sqlite3.connect(self.catalog_path)) as db, db:
            db.execute('CREATE TABLE IF NOT EXISTS targets(code TEXT PRIMARY KEY, name TEXT NOT NULL)')
            db.executemany('INSERT INTO targets(code,name) VALUES(?,?) ON CONFLICT(code) DO NOTHING',[(t['code'],t['name']) for t in targets])

    def target_options(self):
        with closing(sqlite3.connect(self.catalog_path)) as db:
            return [{'code':code,'name':name} for code,name in db.execute('SELECT code,name FROM targets ORDER BY code')]

    def add_target(self,payload):
        if not isinstance(payload,dict) or not isinstance(payload.get('code'),str) or not isinstance(payload.get('name'),str) or not payload['name'].strip():
            raise ValueError('세부품명번호 10자리와 이름을 입력하세요.')
        target=validate_targets([payload])[0]
        with self.lock:
            if any(t['code']==target['code'] for t in self.target_options()):
                raise ValueError('이미 등록된 Target 번호입니다. 목록에서 선택하세요.')
            self.store_targets([target])
            return self.target_options()

    def search_targets(self,query):
        if not isinstance(query,str) or not query.strip() or len(query.strip())>100:
            raise ValueError('세부품명번호 또는 이름을 입력하세요.')
        query=query.strip()
        if query.isdecimal() and not re.fullmatch(r'[0-9]{8}|[0-9]{10}',query):
            raise ValueError('번호는 8자리 또는 10자리로 입력하세요.')
        env=os.environ.copy();env.update(environment())
        if not (env.get('KONEPS_SERVICE_KEY') or env.get('KONEPS_API_KEY')):
            raise ValueError('나라장터 검색 인증키가 설정되지 않았습니다.')
        try:
            result=subprocess.run(['node',str(ROOT/'server/collector/search-targets.mjs')],input=json.dumps({'query':query}),capture_output=True,text=True,encoding='utf-8',env=env,timeout=60)
        except subprocess.TimeoutExpired:
            raise ValueError('검색 시간이 초과되었습니다. 검색어를 구체적으로 입력하고 다시 시도하세요.')
        if result.returncode:raise ValueError('나라장터 Target 검색에 실패했습니다. 인증키와 연결 상태를 확인하세요.')
        return json.loads(result.stdout)

    def delete_target(self,payload):
        code=payload.get('code')
        if not isinstance(code,str) or not re.fullmatch(r'[0-9]{10}',code):raise ValueError('삭제할 Target 번호를 확인하세요.')
        with self.lock:
            if self.run_lock.locked():raise ValueError('검사 완료 후 Target을 삭제하세요.')
            with closing(sqlite3.connect(self.catalog_path)) as db, db:
                db.execute('DELETE FROM targets WHERE code=?',[code])
            self.data['targets']=[t for t in self.data.get('targets',[]) if t['code']!=code]
            if not self.data['targets']:self.data.update(enabled=False,nextScan=None)
            self.save()
            return self.status()

    def save(self):
        self.path.parent.mkdir(parents=True,exist_ok=True)
        temp=self.path.with_suffix('.tmp')
        temp.write_text(json.dumps(self.data,ensure_ascii=False),encoding='utf-8')
        temp.replace(self.path)

    def status(self):
        with self.lock:
            return deepcopy({k:v for k,v in self.data.items() if k!='baseline'}) | {'targetOptions':self.target_options(),'mode':'koneps' if self.collect else 'local-detection','externalCollection':bool(self.collect),'apiKeyConfigured':bool(environment().get('KONEPS_SERVICE_KEY') or environment().get('KONEPS_API_KEY')) if self.collect else False,'todayCollected':self.data['todayCollected'] if self.data['collectionDay']==korean_day(now()) else 0}

    def scan(self,background=False):
        if not self.run_lock.acquire(blocking=False): return self.status()
        with self.lock:
            self.data.update(state='running',lastAttempt=now().isoformat(),nextScan=None,error=None)
            try:self.save()
            except Exception:
                self.run_lock.release()
                raise
        if background:
            Thread(target=self._scan,daemon=True,name='midway-manual-scan').start()
            return self.status()
        return self._scan()

    def _detect(self,current,old,at):
        changes=[] if old is None else [{'mode':key.split(':',1)[0],'id':key.split(':',1)[1],'change':'new' if key not in old else 'updated','detectedAt':at} for key,value in current.items() if old.get(key)!=value]
        day=korean_day(datetime.fromisoformat(at))
        count=self.data['todayCollected'] if self.data['collectionDay']==day else 0
        self.data.update(collectionDay=day,todayCollected=count+len(changes),baseline=current,lastChanges=len(changes),events=(changes+self.data['events'])[:500])

    def _scan(self):
        try:
            try:
                with self.lock:
                    old=self.data['baseline']
                    targets=deepcopy(self.data.get('targets',[]))
                    modes=list(self.data['scanModes'])
                    until=self.data['lastAttempt']
                # Capture pre-collection rows on first external scan, so its new rows count.
                if self.collect and old is None:
                    old=self.read()
                    with self.lock:
                        # Persist before the first write so a crash can still report partial inserts.
                        self.data['baseline']=old
                        self.save()
                failures=[]
                if self.collect:
                    target_hash=hashlib.sha256(json.dumps(sorted(t['code'] for t in targets)).encode()).hexdigest()
                    for mode in modes:
                        with self.lock:
                            domain=self.data['domains'][mode]
                            checkpoint=domain.get('checkpoint') if domain.get('targetsHash')==target_hash else None
                            domain.update(state='running',error=None,processed=0)
                            self.save()
                        try:
                            result=self.collect(mode,checkpoint,targets,until,self.stop)
                            with self.lock:
                                # Advance only to request START; never skip rows arriving during a run.
                                domain.update(state='succeeded',checkpoint=until,lastSuccess=now().isoformat(),targetsHash=target_hash,processed=result.get('processed',0))
                        except Exception as error:
                            message=str(error)[:500]
                            failures.append(f'{mode}: {message}')
                            with self.lock:domain.update(state='failed',error=message)
                        with self.lock:self.save()
                        if self.stop.is_set():
                            failures.append('서버 종료로 검사가 중단되었습니다.')
                            break
                current=self.read(); at=now().isoformat()
                with self.lock:
                    self._detect(current,old,at)
                    self.data.update(state='failed' if failures else 'succeeded',error=' / '.join(failures) or None)
                    if not failures:self.data['lastSuccess']=at
            except Exception as error:
                with self.lock:self.data.update(state='failed',error=str(error)[:500])
            with self.lock:
                self.data['revision']+=1
                self.data['nextScan']=(now()+timedelta(minutes=self.data['intervalMinutes'])).isoformat() if self.data['enabled'] else None
                self.save()
        finally:
            self.run_lock.release()
        return self.status()

    def settings(self,payload):
        if not isinstance(payload.get('enabled'),bool) or payload.get('intervalMinutes') not in [5,15,30,60]: raise ValueError('검사 주기는 5/15/30/60분 중 선택하세요.')
        targets=([] if payload['targets']==[] and not payload['enabled'] else validate_targets(payload['targets'])) if 'targets' in payload else None
        modes=payload.get('scanModes')
        if modes is not None and (not isinstance(modes,list) or not modes or any(mode not in MODES for mode in modes) or len(set(modes))!=len(modes)):raise ValueError('검사할 종류를 하나 이상 선택하세요.')
        with self.lock:
            if self.run_lock.locked():raise ValueError('검사 완료 후 설정을 저장하세요.')
            if targets is not None:
                known={t['code']:t for t in self.target_options()}
                if any(t['code'] not in known for t in targets):raise ValueError('등록되지 않았거나 삭제된 Target입니다. 목록을 새로 불러오세요.')
                targets=[known[t['code']] for t in targets]
            self.data.update(enabled=payload['enabled'],intervalMinutes=payload['intervalMinutes'])
            if targets is not None:
                self.data['targets']=targets
            if modes is not None:self.data['scanModes']=modes
            self.data['nextScan']=(now()+timedelta(minutes=self.data['intervalMinutes'])).isoformat() if self.data['enabled'] else None
            self.save()
        return self.status()

    def start(self):
        def loop():
            # The first external scan starts immediately only when enabled.
            if self.data['enabled']: self.scan()
            while not self.stop.wait(1):
                with self.lock: due=self.data['enabled'] and self.data['nextScan'] and now()>=datetime.fromisoformat(self.data['nextScan'])
                if due: self.scan()
        Thread(target=loop,daemon=True,name='midway-live').start()

    def today_events(self, events):
        today=korean_day(now())
        selected=sorted((e for e in events if korean_day(datetime.fromisoformat(e['detectedAt']))==today),key=lambda e:e['detectedAt'],reverse=True)[:3]
        result=[]
        for event in selected:
            mode=event['mode']
            sources={
                'bid':('market','bid_notice','bid_notice_id','bid_ntce_name'),
                'award':('market','award_result','award_result_id','bid_ntce_name'),
                'contract':('market','contract_result','contract_result_id','contract_name'),
                'forecast':('forecast','order_plan','id','business_name'),
            }
            if mode not in sources: continue
            domain,table,key,title=sources[mode]
            with connect(domain) as db:
                found=db.execute(f'SELECT {title} FROM {table} WHERE {key}=?',[event['id']]).fetchone()
            result.append({**event,'name':found[0] if found and found[0] else '항목 '+str(event['id'])})
        return result

    def overview(self):
        status=self.status()
        return {'scan':status,'todayEvents':self.today_events(status['events']),'latest':{mode:market.latest(mode,10) for mode in ['bid','award','contract']} | {'forecast':forecast.latest(10)},'facility':facility.top10(),'recentForecast':forecast.latest(),'recentBids':market.latest()}
