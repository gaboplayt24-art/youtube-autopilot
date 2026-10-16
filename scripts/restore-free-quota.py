"""Merge durable private-release quota history and legacy artifacts, never dropping recorded events."""
import io
import json
import os
from pathlib import Path
import subprocess
import zipfile
from github_checkpoints import latest_quota, read_quota


def merge_ledgers(snapshots):
    events, adjustments = {}, {}
    result = {'version': 2, 'events': [], 'adjustments': [], 'runtimeSeconds': 0, 'historyUnverified': False}
    for _, ledger in sorted(snapshots, key=lambda item: item[0]):
        if not isinstance(ledger.get('events'), list):
            raise ValueError('Invalid quota snapshot')
        for event in ledger['events']:
            events[event['id']] = event
        for adjustment in ledger.get('adjustments', []):
            adjustments[adjustment['id']] = adjustment
        result['runtimeSeconds'] = max(result['runtimeSeconds'], ledger.get('runtimeSeconds', 0))
        result['historyUnverified'] |= ledger.get('historyUnverified', False) or ledger.get('version') != 2
    result['events'] = list(events.values())
    result['adjustments'] = list(adjustments.values())
    return result


def main():
    repo = os.environ['GITHUB_REPOSITORY']
    artifacts = json.loads(subprocess.check_output(['gh', 'api', f'repos/{repo}/actions/artifacts?name=free-quota-ledger&per_page=100']))['artifacts']
    eligible = [a for a in artifacts if not a['expired']]
    snapshots = []
    if eligible:
        a = max(eligible, key=lambda a: (a['created_at'], a['id']))
        archive = zipfile.ZipFile(io.BytesIO(subprocess.check_output(['gh', 'api', f'repos/{repo}/actions/artifacts/{a["id"]}/zip'])))
        entry = next(n for n in archive.namelist() if n.endswith('free-quota-ledger.json'))
        snapshots.append((a['created_at'], json.loads(archive.read(entry))))
    asset = latest_quota(repo)
    if asset:
        snapshots.append((asset['created_at'], read_quota(repo, asset)))
    if not snapshots:
        print(json.dumps({'event': 'quota_first_run'}))
        return
    ledger = merge_ledgers(snapshots)
    audit = json.loads(Path('data/quota-audits/2026-10-06.json').read_text())
    if not any(a['id'] == audit['id'] for a in ledger['adjustments']):
        ledger['adjustments'].append({k: audit[k] for k in ['id', 'dayUTC', 'reservedNeurons', 'reason']})
    ledger['historyUnverified'] = True  # Known historical gap is retained, not fabricated away.
    output = Path(os.environ['FREE_QUOTA_LEDGER_PATH'])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(ledger))
    print(json.dumps({'event': 'quota_restored', 'snapshotsMerged': len(snapshots), 'events': len(ledger['events'])}))


if __name__ == '__main__':
    main()
