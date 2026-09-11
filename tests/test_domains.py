"""Focused offline regression checks against imported, read-only SQLite snapshots."""
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, main
from unittest.mock import patch
from datetime import datetime, timezone
import sqlite3
from server import company, certification, facility, forecast, market
from server.db import connect
from server.live import LiveService

class DomainRegression(TestCase):
    def test_domain_connections_cannot_write(self):
        for domain in ['market','forecast','facility','company','certification']:
            with self.subTest(domain=domain),connect(domain) as db:
                with self.assertRaises(sqlite3.OperationalError): db.execute('CREATE TABLE midway_should_not_exist(id)')

    def test_company_latest_financials_and_target_count(self):
        target=company.options()['targets'][0]['id']
        result=company.search({'target':target})
        with connect('company') as db:
            expected=db.execute('SELECT COUNT(DISTINCT company_id) FROM company_industries WHERE target_id=?',[target]).fetchone()[0]
            self.assertEqual(result['total'],expected)
            for row in result['rows']:
                fiscal=db.execute('SELECT MAX(fiscal_year) FROM company_financial_statements WHERE company_id=?',[row['companyId']]).fetchone()[0]
                self.assertEqual(row['fiscalYear'],fiscal)
                self.assertEqual(company.detail(row['companyId'])['company']['companyId'],row['companyId'])
        self.assertEqual(company.search({'page':'999999'})['page'],company.search({})['totalPages'])

    def test_company_legal_prefix_and_script_priority(self):
        db=sqlite3.connect(':memory:');db.row_factory=sqlite3.Row
        db.executescript('CREATE TABLE companies(company_id TEXT,company_name TEXT); CREATE TABLE company_financial_statements(company_id TEXT,fiscal_year INT,total_assets_krw_million INT,revenue_krw_million INT,operating_income_krw_million INT,net_income_krw_million INT); CREATE TABLE company_user_metadata(company_id TEXT,favorite_color TEXT,memo TEXT,classification TEXT); CREATE TABLE company_disclosure_state(company_id TEXT,disclosure_status TEXT);')
        db.executemany('INSERT INTO companies VALUES(?,?)',[(str(i),name) for i,name in enumerate(['123 회사','Alpha','㈜나래','(주)가람','주식회사 가나'])])
        names=[r[0] for r in db.execute('SELECT company_name FROM companies c ORDER BY '+company.NAME_ORDER)]
        self.assertEqual(names,['주식회사 가나','(주)가람','㈜나래','Alpha','123 회사'])
        db.close()

    def test_certification_preferred_run_and_corrections(self):
        result=certification.search({})
        with connect('certification') as db:
            preferred=certification.preferred_run(db)
            self.assertEqual(result['runId'],preferred)
            corrections=db.execute("SELECT c.certification_no,c.corrected_value FROM certification_corrections c JOIN certification_records r ON r.certification_type=c.certification_type AND r.certification_no=c.certification_no WHERE c.field_name='company_name' AND r.run_id=?",[preferred]).fetchall()
            for number,value in corrections:
                corrected=certification.search({'q':value,'number':number})
                self.assertTrue(any(r['company_name']==value and r['company_name_corrected'] for r in corrected['rows']))
        db=sqlite3.connect(':memory:')
        db.executescript("CREATE TABLE collection_runs(id INTEGER,status TEXT,source_mode TEXT); INSERT INTO collection_runs VALUES(1,'completed','production_v2'),(2,'completed','sample'),(3,'running','production_v2');")
        self.assertEqual(certification.preferred_run(db),1);db.close()

    def test_forecast_prefix_ignores_spaces_and_paginates(self):
        with connect('forecast') as db:
            source=db.execute("SELECT business_name FROM order_plan WHERE length(business_name)>4 ORDER BY id LIMIT 1").fetchone()[0]
        prefix=source.replace(' ','')[:2]
        result=forecast.search({'q':' '.join(prefix)})
        self.assertGreater(result['total'],0)
        for row in result['rows']:
            self.assertTrue(any(str(row[k] or '').replace(' ','').lower().startswith(prefix.lower()) for k in ['business_name','detail_product_name','order_institution_name']))
        first,second=forecast.search({}),forecast.search({'page':'2'})
        self.assertFalse({r['id'] for r in first['rows']}&{r['id'] for r in second['rows']})

    def test_facility_representatives_and_top10_units(self):
        for group in facility.top10():
            self.assertEqual(len(group['rows']),10)
            self.assertEqual(len({r['facilityId'] for r in group['rows']}),10)
            self.assertAlmostEqual(sum(r['proportion'] for r in group['rows']),1)
            self.assertEqual(group['total'],sum(r['primaryCapacityValue'] for r in group['rows']))
            expected='M3_PER_DAY' if group['category']=='PUBLIC_SEWAGE' else 'TON_PER_DAY'
            self.assertTrue(all(r['primaryCapacityUnit']==expected for r in group['rows']))
            capacities=[r['primaryCapacityValue'] for r in group['rows']]
            self.assertEqual(capacities,sorted(capacities,reverse=True))
            with connect('facility') as db:
                for row in group['rows']:
                    self.assertIsNone(db.execute('SELECT 1 FROM logical_facility_member WHERE member_facility_id=? AND master_facility_id!=member_facility_id',[row['facilityId']]).fetchone())
        self.assertEqual(facility.search({'page':'999999'})['page'],facility.search({})['totalPages'])

    def test_market_bound_and_domain_detail_sort(self):
        for mode in ['bid','award','contract']:
            result=market.search({'mode':mode,'limit':'500'})
            self.assertLessEqual(len(result['rows']),500)
            self.assertIsNone(result['total'])
            dates=[r['date'] or '' for r in result['rows']]
            self.assertEqual(dates,sorted(dates,reverse=True))
            detail=market.detail(result['rows'][0]['id'],mode)
            if mode=='award':
                ranks=[int(r['opening_rank']) for r in detail['participants'] if str(r['opening_rank']).isdigit() and int(r['opening_rank'])>0]
                self.assertEqual(ranks,sorted(ranks))
            if mode=='contract':
                corporations=detail['corporations']
                if any(r['role_name']=='주계약업체' for r in corporations): self.assertEqual(corporations[0]['role_name'],'주계약업체')
        with self.assertRaises(ValueError):market.search({'classification':'1234'})
        with self.assertRaises(ValueError):market.search({'target':"12345678' OR 1=1"})

class LiveRegression(TestCase):
    def test_today_events_use_korean_detection_day_and_latest_three(self):
        with TemporaryDirectory() as directory:
            service=LiveService(Path(directory)/'state.json',lambda:{})
            record=market.latest('bid',1)[0]
            events=[{'mode':'bid','id':str(record['id']),'change':'new','detectedAt':at} for at in [
                '2026-09-09T14:59:59+00:00',
                '2026-09-09T15:00:00+00:00',
                '2026-09-10T01:00:00+00:00',
                '2026-09-10T02:00:00+00:00',
                '2026-09-10T03:00:00+00:00',
            ]]
            with patch('server.live.now',return_value=datetime(2026,9,10,4,tzinfo=timezone.utc)):
                result=service.today_events(events)
                self.assertEqual([r['detectedAt'] for r in result],[e['detectedAt'] for e in reversed(events[-3:])])
                self.assertTrue(all(r['name']==record['name'] for r in result))
                self.assertEqual(len(service.today_events(events[:2])),1)
                self.assertEqual(service.today_events(events[:1]),[])

    def test_baseline_new_updated_failure_and_settings_survive_restart(self):
        with TemporaryDirectory() as directory:
            current={'bid:1':'a','forecast:2':'b'}
            path=Path(directory)/'state.json'
            service=LiveService(path,lambda:current.copy())
            self.assertEqual(service.scan()['lastChanges'],0)
            self.assertEqual(service.scan()['lastChanges'],0)
            current.update({'bid:1':'changed','award:4':'new'})
            self.assertEqual(service.scan()['lastChanges'],2)
            self.assertEqual({x['change'] for x in service.status()['events']},{'new','updated'})
            self.assertEqual(service.status()['todayCollected'],2)
            self.assertEqual(service.scan()['todayCollected'],2)
            self.assertEqual(LiveService(path).status()['todayCollected'],2)
            service.data['collectionDay']='2000-01-01'
            self.assertEqual(service.status()['todayCollected'],0)
            current['bid:5']='new day'
            self.assertEqual(service.scan()['todayCollected'],1)
            success=service.status()['lastSuccess']
            def fail():raise RuntimeError('database unavailable')
            service.read=fail
            self.assertEqual(service.scan()['state'],'failed')
            self.assertEqual(service.status()['lastSuccess'],success)
            service.settings({'enabled':False,'intervalMinutes':30})
            restored=LiveService(path)
            self.assertFalse(restored.status()['enabled'])
            self.assertIsNone(restored.status()['nextScan'])
            self.assertNotIn('baseline',restored.status())

if __name__=='__main__':main()
