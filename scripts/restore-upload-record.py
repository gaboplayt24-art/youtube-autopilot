"""Restore the newest upload record artifact (upload-<RUN_ID>) into the run directory.
Publish re-runs then resume their YouTube/TikTok stages instead of repeating them:
no duplicate Short, playlist item or TikTok post, and no overwrite of owner-edited metadata.
"""
import json, os, subprocess, zipfile, io
from pathlib import Path
repo, run = os.environ['GITHUB_REPOSITORY'], os.environ['RUN_ID']
artifacts = json.loads(subprocess.check_output(['gh', 'api', f'repos/{repo}/actions/artifacts?name=upload-{run}&per_page=100']))['artifacts']
eligible = [a for a in artifacts if not a['expired']]
if not eligible:
    print(json.dumps({'event': 'upload_record_first_publish', 'runId': run}))
else:
    a = max(eligible, key=lambda a: (a['created_at'], a['id']))
    archive = zipfile.ZipFile(io.BytesIO(subprocess.check_output(['gh', 'api', f'repos/{repo}/actions/artifacts/{a["id"]}/zip'])))
    target = Path('data/runs') / run
    target.mkdir(parents=True, exist_ok=True)
    names = set(archive.namelist())
    restored = []
    for name in sorted(names):
        # Records are flat files; never write outside the run directory.
        if Path(name).name != name or not name.endswith('.json'):
            continue
        # A stage checkpoint is only resumable with its integrity file; older artifacts without one are re-run safely.
        stage = name[:-len('.integrity.json')] if name.endswith('.integrity.json') else name[:-len('.json')]
        if name not in ('upload.json', 'tiktok.json') and not (stage + '.json' in names and stage + '.integrity.json' in names):
            continue
        (target / name).write_bytes(archive.read(name))
        restored.append(name)
    print(json.dumps({'event': 'upload_record_restored', 'artifactId': a['id'], 'files': restored}))
