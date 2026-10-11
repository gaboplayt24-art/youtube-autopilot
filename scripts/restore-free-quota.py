"""Restore the newest durable quota artifact, including failed workflows.
All inference workflows share one GitHub concurrency group; do not run them in parallel.
Cloudflare FREE-plan enforcement also protects against unrelated account usage.
"""
import json, os, subprocess, zipfile, io
from pathlib import Path
repo = os.environ['GITHUB_REPOSITORY']
artifacts = json.loads(subprocess.check_output(['gh','api',f'repos/{repo}/actions/artifacts?name=free-quota-ledger&per_page=100']))['artifacts']
eligible = [a for a in artifacts if not a['expired']]
output = Path(os.environ['FREE_QUOTA_LEDGER_PATH'])
def latest(ledger):
    return max([e.get('at', '') for e in ledger.get('events', [])], default='')
# A copy restored from the Actions cache may be newer than the newest artifact (artifact storage can be full).
cached = json.loads(output.read_text()) if output.exists() else None
if eligible or cached:
    ledger = cached
    if eligible:
        # IDs are identifiers, not a documented chronological ordering guarantee.
        a = max(eligible, key=lambda a:(a['created_at'], a.get('updated_at', a['created_at']), a['id']))
        data = subprocess.check_output(['gh','api',f'repos/{repo}/actions/artifacts/{a["id"]}/zip'])
        archive = zipfile.ZipFile(io.BytesIO(data))
        entry = next(n for n in archive.namelist() if n.endswith('free-quota-ledger.json'))
        artifact_ledger = json.loads(archive.read(entry))
        if ledger is None or (latest(artifact_ledger), len(artifact_ledger.get('events', []))) > (latest(ledger), len(ledger.get('events', []))):
            ledger = artifact_ledger
    output.parent.mkdir(parents=True,exist_ok=True)
    if ledger.get('version') != 2:
        ledger['historyUnverified']=True
    audit=json.loads(Path('data/quota-audits/2026-10-06.json').read_text())
    ledger.setdefault('adjustments',[])
    if not any(item['id']==audit['id'] for item in ledger['adjustments']):
        ledger['adjustments'].append({key:audit[key] for key in ['id','dayUTC','reservedNeurons','reason']})
    ledger['historyUnverified']=True  # This audit records a known history gap.
    output.write_text(json.dumps(ledger))
    print(json.dumps({'event':'quota_restored','source':'artifact' if ledger is not cached else 'cache','events':len(ledger.get('events', []))}))
else:
    print(json.dumps({'event':'quota_first_run','protection':'Cloudflare FREE plan confirmation required'}))
