import unittest
from server.facility import detail
from server.db import connect

class FacilityDetail(unittest.TestCase):
    def test_provenance_and_zero_preserved(self):
        data = detail('bd4052bf-e96e-5726-8dda-dbdee50426b2')
        self.assertEqual({r.get('metric_key_raw') for r in data['observations'] if r['value']==388.7}, {'고도 방류량','방류량'})
        self.assertTrue(all('member_facility_id' in r for r in data['observations']))
        zero = detail('000254e5-f377-5844-b390-1f200806fbff')
        self.assertTrue(any(r['value']==0 and r.get('metric_key_raw') for r in zero['observations']))

    def test_member_resolves_to_master(self):
        with connect('facility') as db:
            member, master = db.execute('SELECT member_facility_id,master_facility_id FROM logical_facility_member WHERE member_facility_id!=master_facility_id LIMIT 1').fetchone()
        a,b = detail(member),detail(master)
        self.assertEqual(a,b)
        self.assertEqual(a['facility']['facilityId'],master)
        self.assertTrue(any(r['facility_id']==member for r in a['members']))
        self.assertTrue(a['categoryContexts'])

    def test_missing(self):
        with self.assertRaises(LookupError): detail('missing')

if __name__ == '__main__': unittest.main()
