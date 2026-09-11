"""Lifecycle tests with offline collectors, no external API calls."""
from pathlib import Path
from contextlib import closing
from tempfile import TemporaryDirectory
from threading import Event
from unittest.mock import patch
import sqlite3
import json
from server import live_collector
from unittest import TestCase, main
from server.live import LiveService


class ExternalScanTests(TestCase):
    def test_registered_targets_survive_deselection_and_restart(self):
        with TemporaryDirectory() as directory:
            path=Path(directory)/'state.json'
            service=LiveService(path,lambda:{})
            pump={'code':'4015150501','name':'정량펌프'}
            laptop={'code':'4321150301','name':'노트북컴퓨터'}
            service.store_targets([pump])
            service.settings({'enabled':False,'intervalMinutes':15,'targets':[pump]})
            service.add_target(laptop)
            self.assertEqual(service.status()['targets'],[pump])
            service.settings({'enabled':False,'intervalMinutes':15,'targets':[laptop]})
            service.settings({'enabled':False,'intervalMinutes':15,'targets':[pump]})
            restored=LiveService(path,lambda:{})
            self.assertEqual(restored.status()['targets'],[pump])
            self.assertEqual(restored.status()['targetOptions'],[pump,laptop])
            with closing(sqlite3.connect(restored.catalog_path)) as db:
                self.assertEqual(db.execute('SELECT COUNT(*) FROM targets').fetchone()[0],2)
            with self.assertRaises(ValueError):restored.add_target(laptop)
            with self.assertRaises(ValueError):restored.add_target({'code':'bad','name':'invalid'})
            with self.assertRaises(ValueError):restored.add_target({'code':'4321150701','name':' '})
            self.assertEqual(restored.target_options(),[pump,laptop])

    def test_delete_selected_target_persists_and_rejects_stale_selection(self):
        with TemporaryDirectory() as directory:
            path=Path(directory)/'state.json'
            service=LiveService(path,lambda:{})
            target={'code':'4015150501','name':'정량펌프'}
            service.add_target(target)
            service.settings({'enabled':True,'intervalMinutes':15,'targets':[target]})
            service.run_lock.acquire()
            with self.assertRaises(ValueError):service.delete_target(target)
            service.run_lock.release()
            result=service.delete_target(target)
            self.assertEqual(result['targets'],[])
            self.assertFalse(result['enabled'])
            restored=LiveService(path,lambda:{})
            self.assertEqual(restored.target_options(),[])
            with self.assertRaises(ValueError):restored.settings({'enabled':True,'intervalMinutes':15,'targets':[target]})
            restored.settings({'enabled':False,'intervalMinutes':15,'targets':[]})
            restored.add_target(target)
            self.assertEqual(restored.target_options(),[target])

    def test_partial_failure_keeps_own_checkpoint_and_counts_successful_rows(self):
        with TemporaryDirectory() as directory:
            current={'bid:1':'old'}
            calls=[]
            failed={'award'}
            def collect(mode,checkpoint,targets,until,stop):
                calls.append((mode,checkpoint,until))
                self.assertIsNotNone(json.loads(path.read_text(encoding='utf-8'))['baseline'])
                if mode in failed:raise RuntimeError('API unavailable')
                current[mode+':2']='new'
                return {'processed':1}
            path=Path(directory)/'state.json'
            service=LiveService(path,lambda:current.copy(),collect)
            service.data['targets']=[{'code':'4015155301','name':'pump'}]
            first=service.scan()
            self.assertEqual(first['state'],'failed')
            self.assertIsNone(first['lastSuccess'])
            self.assertEqual(first['lastChanges'],3)
            self.assertIsNone(first['domains']['award']['checkpoint'])
            checkpoint=first['domains']['bid']['checkpoint']
            self.assertEqual(checkpoint,first['lastAttempt'])
            restored=LiveService(path,lambda:current.copy(),collect)
            failed.clear()
            second=restored.scan()
            self.assertEqual(second['state'],'succeeded')
            self.assertEqual(second['lastChanges'],1)
            self.assertEqual(second['todayCollected'],4)
            self.assertEqual(calls[4][1],checkpoint)
            self.assertIsNone(calls[6][1])
            self.assertEqual(second['revision'],2)

    def test_nonblocking_status_duplicate_click_and_settings_lock(self):
        with TemporaryDirectory() as directory:
            entered=Event(); release=Event();calls=[]
            def collect(mode,*args):
                calls.append(mode);entered.set();release.wait(3);return {'processed':0}
            service=LiveService(Path(directory)/'state.json',lambda:{},collect)
            service.data['targets']=[{'code':'4015155301','name':'pump'}]
            service.data['scanModes']=['bid']
            service.scan(background=True)
            self.assertTrue(entered.wait(1))
            self.assertEqual(service.status()['state'],'running')
            self.assertEqual(service.scan(background=True)['state'],'running')
            with self.assertRaisesRegex(ValueError,'검사 완료'):
                service.settings({'enabled':False,'intervalMinutes':5})
            release.set()
            self.assertTrue(service.run_lock.acquire(timeout=3));service.run_lock.release()
            self.assertEqual(calls,['bid'])
            self.assertEqual(service.status()['state'],'succeeded')

    def test_target_changes_reset_external_checkpoint_and_validate_before_saving(self):
        with TemporaryDirectory() as directory:
            calls=[]
            def collect(mode,checkpoint,*args):calls.append(checkpoint);return {}
            service=LiveService(Path(directory)/'state.json',lambda:{},collect)
            service.store_targets([{'code':'4015155301','name':'pump'},{'code':'4015155300','name':'pump'}])
            service.settings({'enabled':False,'intervalMinutes':15,'scanModes':['bid'],'targets':[{'code':'4015155301','name':'pump'}]})
            service.scan();service.scan()
            self.assertIsNotNone(calls[1])
            service.settings({'enabled':False,'intervalMinutes':15,'targets':[{'code':'4015155300','name':'pump'}]})
            service.scan();self.assertIsNone(calls[2])
            with self.assertRaises(ValueError):service.settings({'enabled':True,'intervalMinutes':15,'targets':[{'code':'bad'}]})
            self.assertFalse(service.status()['enabled'])

    def test_local_success_does_not_become_external_checkpoint(self):
        with TemporaryDirectory() as directory:
            path=Path(directory)/'state.json'
            local=LiveService(path,lambda:{'bid:1':'old'});local.scan()
            calls=[]
            def collect(mode,checkpoint,*args):calls.append(checkpoint);return {}
            service=LiveService(path,lambda:{'bid:1':'old'},collect)
            self.assertIsNone(service.status()['lastSuccess'])
            service.scan();self.assertTrue(all(value is None for value in calls))

    def test_backup_is_closed_before_windows_rename_and_never_overwritten(self):
        with TemporaryDirectory() as directory:
            root=Path(directory)
            source=root/'db_local/market/mona-radar-market.sqlite3'
            source.parent.mkdir(parents=True)
            db=sqlite3.connect(source);db.execute('CREATE TABLE sample(id)');db.commit();db.close()
            with patch.object(live_collector,'ROOT',root):
                live_collector.backup_before_collection('market')
                backup=root/'db_local/live/backups/market-before-external-scan.sqlite'
                original=backup.read_bytes()
                db=sqlite3.connect(source);db.execute('INSERT INTO sample VALUES(1)');db.commit();db.close()
                live_collector.backup_before_collection('market')
                self.assertEqual(backup.read_bytes(),original)


if __name__=='__main__':main()
