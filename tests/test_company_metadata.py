from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, main
from unittest.mock import patch
import sqlite3
from contextlib import closing
from server import company
from server.db import ROOT, FILES

class CompanyMetadataTests(TestCase):
    def test_metadata_roundtrip_and_our_company_rules(self):
        with TemporaryDirectory() as temp:
            root=Path(temp)
            path=root/'db_local'/FILES['company']
            path.parent.mkdir(parents=True)
            with closing(sqlite3.connect(ROOT/'db_local'/FILES['company'])) as source, closing(sqlite3.connect(path)) as target:
                source.backup(target)
            with patch('server.db.ROOT',root):
                with closing(sqlite3.connect(path)) as db, db:
                    db.execute('DELETE FROM app_our_company')
                    ids=[r[0] for r in db.execute('SELECT company_id FROM companies LIMIT 2')]
                company.save_metadata({'companyId':ids[0],'favoriteColor':'BLUE','classification':'테스트','memo':'확인'})
                record=company.detail(ids[0])['company']
                self.assertEqual(record['favoriteColor'],'BLUE')
                self.assertEqual(record['classification'],'테스트')
                company.save_metadata({'companyId':ids[0],'action':'our','enabled':True})
                self.assertEqual(company.options()['ourCompany']['companyId'],ids[0])
                self.assertIsNone(company.detail(ids[0])['company']['favoriteColor'])
                with self.assertRaises(ValueError): company.save_metadata({'companyId':ids[1],'action':'our','enabled':True})
                with self.assertRaises(ValueError): company.save_metadata({'companyId':ids[0],'favoriteColor':'RED'})
                company.save_metadata({'companyId':ids[0],'action':'our','enabled':False})
                self.assertIsNone(company.options()['ourCompany'])
                with self.assertRaises(ValueError): company.save_metadata({'companyId':ids[0],'memo':'x'*41})
                groups=[{'color':c,'name':'그룹 '+c} for c in company.COLORS]
                company.save_metadata({'action':'groups','groups':groups})
                self.assertEqual(len(company.options()['favoriteGroups']),5)

if __name__=='__main__': main()
