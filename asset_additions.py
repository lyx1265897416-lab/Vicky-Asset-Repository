"""Append-only asset registrations, isolated from other sessions' canonical ledgers."""
import json
from pathlib import Path


def registrations(root):
    for path in sorted((Path(root) / 'asset-additions').glob('*.json')):
        record = json.loads(path.read_text())
        if record.get('status') == 'ready':
            yield record


def merge_additions(manifest, root):
    from library_deletion import deleted_keys
    excluded = deleted_keys(Path(root))
    existing = {a['path']: a for a in manifest['assets']}
    for record in registrations(root):
        asset = record['asset']
        if asset['path'] in excluded or asset.get('id') in excluded:
            continue
        if asset['path'] not in existing:
            manifest['assets'].append(dict(asset))
            existing[asset['path']] = asset
    manifest['asset_count'] = len(manifest['assets'])
    return manifest


def metadata_additions(root):
    return {r['asset']['path']: r['generation'] for r in registrations(root)}


def membership_additions(root):
    return {r['asset']['path']: {'character_ids': r['character_ids'], 'view_type': r['view_type']} for r in registrations(root)}
