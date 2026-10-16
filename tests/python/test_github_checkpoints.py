import importlib.util
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
import github_checkpoints as store


class CheckpointTests(unittest.TestCase):
    def test_archive_parts_roundtrip_excludes_lock_and_detects_corruption(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'source'
            parts = Path(directory) / 'parts'
            root.mkdir(); parts.mkdir()
            (root / 'raw.wav').write_bytes(os.urandom(2048))
            (root / '.lock').write_text('123')
            (root / 'status.json').write_text('{"state":"failed","stage":"render"}')
            _, manifest = store.pack(root, parts, 'episode', '123', '1', chunk_bytes=100)
            self.assertGreater(len(manifest['parts']), 1)
            target = Path(directory) / 'restored'
            store.unpack(manifest, parts, target, 'episode', '123')
            self.assertEqual((target / 'raw.wav').read_bytes(), (root / 'raw.wav').read_bytes())
            self.assertFalse((target / '.lock').exists())
            with self.assertRaises(ValueError):
                store.unpack(manifest, parts, target, 'different-episode', '123')
            (parts / manifest['parts'][0]['name']).write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError, 'checksum'):
                store.unpack(manifest, parts, target, 'episode', '123')

    def test_zip_traversal_is_rejected_before_extraction(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'part.zip'
            with zipfile.ZipFile(path, 'w') as zipped:
                zipped.writestr('../escape.txt', 'must not escape')
            manifest = {'version': 1, 'runId': 'a', 'sourceRunId': '1', 'parts': [
                {'name': path.name, 'bytes': path.stat().st_size, 'sha256': store.digest(path)}]}
            with self.assertRaisesRegex(ValueError, 'Unsafe'):
                store.unpack(manifest, directory, Path(directory) / 'target', 'a', '1')
            self.assertFalse((Path(directory) / 'escape.txt').exists())

    def test_repository_metadata_endpoint_does_not_add_a_trailing_slash(self):
        with patch.object(store, 'gh', return_value=b'{"private":true}') as gh:
            self.assertTrue(store.api_json('owner/repo', '')['private'])
            gh.assert_called_once_with('api', 'repos/owner/repo')

    def test_public_repository_cannot_create_or_upload_release(self):
        with patch.object(store, 'api_json', return_value={'private': False}), patch.object(store, 'public_storage_approved', return_value=False), patch.object(store, 'gh') as gh:
            with self.assertRaisesRegex(RuntimeError, 'PRIVATE'):
                store.release('owner/repo', 'checkpoint')
            gh.assert_not_called()

    def test_owner_approved_public_repository_keeps_checkpoints(self):
        with patch.object(store, 'api_json', return_value={'private': False}), patch.object(store, 'public_storage_approved', return_value=True):
            store.require_private('owner/repo')

    def test_newest_quota_is_selected_from_actual_asset_times_and_hash_verified(self):
        payload = b'{"version":2,"events":[]}'
        checksum = hashlib.sha256(payload).hexdigest()[:12]
        assets = [{'id': 10, 'name': f'free-quota-ledger-1-attempt-1-{checksum}.json', 'created_at': '2026-10-14T10:00:00Z'},
                  {'id': 2, 'name': f'free-quota-ledger-2-attempt-1-{checksum}.json', 'created_at': '2026-10-14T11:00:00Z'}]
        with patch.object(store, 'api_json', side_effect=[{'private': True}, {'draft': False, 'prerelease': True, 'assets': assets}]):
            self.assertEqual(store.latest_quota('owner/repo')['id'], 2)
        with patch.object(store, 'gh', return_value=payload):
            self.assertEqual(store.read_quota('owner/repo', assets[1])['events'], [])
            with self.assertRaisesRegex(ValueError, 'checksum'):
                store.read_quota('owner/repo', {**assets[1], 'name': 'free-quota-ledger-2-attempt-1-000000000000.json'})

    def test_quota_merge_retains_events_missing_from_a_newer_legacy_snapshot(self):
        spec = importlib.util.spec_from_file_location('quota_restore', Path(__file__).resolve().parents[2] / 'scripts/restore-free-quota.py')
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        result = module.merge_ledgers([
            ('2026-10-14T10:00:00Z', {'version': 2, 'events': [{'id': 'paid-reservation', 'paidUsd': 0.2}], 'adjustments': [{'id': 'audit'}]}),
            ('2026-10-14T11:00:00Z', {'version': 2, 'events': [{'id': 'later-request', 'paidUsd': 0}], 'historyUnverified': True})])
        self.assertEqual({e['id'] for e in result['events']}, {'paid-reservation', 'later-request'})
        self.assertEqual(sum(e['paidUsd'] for e in result['events']), 0.2)
        self.assertTrue(result['historyUnverified'])
        self.assertEqual(result['adjustments'], [{'id': 'audit'}])

    def test_upload_retry_restores_complete_base_then_overlays_existing_video_id(self):
        import shutil
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            base, record, assets_dir = root/'base', root/'record', root/'assets'
            base.mkdir(); record.mkdir(); assets_dir.mkdir()
            (base/'final.mp4').write_bytes(b'original-video-fixture')
            (base/'metadata.json').write_text('{"title":"Original title"}')
            (record/'upload.json').write_text('{"videoId":"already-uploaded"}')
            store.pack(base, assets_dir, 'episode', '100', '1')
            with patch.dict(os.environ, {'SOURCE_RUN_ID':'100'}):
                store.pack(record, assets_dir, 'episode', '200', '1', record_only=True)
            assets = [{'id':i,'name':p.name,'created_at':'2026-10-14T10:00:00Z'} for i,p in enumerate(assets_dir.glob('*.manifest.json'))]
            def api(repo, route, optional=False):
                return {'private':True} if not route else {'assets':assets}
            def download(*args):
                name=args[args.index('--pattern')+1]; target=Path(args[args.index('--dir')+1])/name
                shutil.copyfile(assets_dir/name,target)
                return b''
            previous=Path.cwd()
            try:
                os.chdir(root)
                with patch.object(store,'api_json',side_effect=api),patch.object(store,'gh',side_effect=download):
                    store.restore('owner/repo','episode','200','production')
                target=root/'data/runs/episode'
                self.assertEqual((target/'final.mp4').read_bytes(),b'original-video-fixture')
                self.assertEqual(json.loads((target/'upload.json').read_text())['videoId'],'already-uploaded')
            finally:
                os.chdir(previous)

    def test_upload_record_does_not_duplicate_video_and_has_separate_version_name(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / 'source'; root.mkdir()
            (root / 'final.mp4').write_bytes(b'video-unit-fixture')
            (root / 'upload.json').write_text('{"videoId":"unit-fixture"}')
            (root / 'owner-cover-handoff.json').write_text('{"state":"awaiting_owner_cover_in_studio"}')
            (root / 'owner-cover-confirmation.json').write_text('{"confirmedAt":"2026-10-15T20:00:00Z"}')
            _, manifest = store.pack(root, directory, 'episode', '123', '1', record_only=True)
            self.assertEqual(manifest['files'], 3)
            self.assertTrue(manifest['parts'][0]['name'].startswith('upload-'))


if __name__ == '__main__':
    unittest.main()
