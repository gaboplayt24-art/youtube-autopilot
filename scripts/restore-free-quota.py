"""Restore the newest durable quota artifact, including failed workflows.
All inference workflows share one GitHub concurrency group; do not run them in parallel.
Cloudflare FREE-plan enforcement also protects against unrelated account usage.
"""
import json, os, subprocess, zipfile, io
from pathlib import Path
repo = os.environ['GITHUB_REPOSITORY']
artifacts = json.loads(subprocess.check_output(['gh','api',f'repos/{repo}/actions/artifacts?name=free-quota-ledger&per_page=100']))['artifacts']
eligible = [a for a in artifacts if not a['expired']]
if eligible:
    a = max(eligible, key=lambda a:a['id'])
    data = subprocess.check_output(['gh','api',f'repos/{repo}/actions/artifacts/{a["id"]}/zip'])
    archive = zipfile.ZipFile(io.BytesIO(data))
    entry = next(n for n in archive.namelist() if n.endswith('free-quota-ledger.json'))
    output = Path(os.environ['FREE_QUOTA_LEDGER_PATH']);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_bytes(archive.read(entry))
    print(json.dumps({'event':'quota_restored','artifactId':a['id']}))
else:
    print(json.dumps({'event':'quota_first_run','protection':'Cloudflare FREE plan confirmation required'}))
