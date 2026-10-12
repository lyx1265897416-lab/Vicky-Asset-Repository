"""Validate and expose reusable music independently of image and voice catalogs."""
from pathlib import Path
import hashlib, json

def attach_bgm(manifest, root):
    root=Path(root); catalog=root/'bgm-library.json'
    tracks=json.loads(catalog.read_text())['tracks'] if catalog.exists() else []
    ids=set()
    for track in tracks:
        if track['id'] in ids: raise ValueError('Duplicate BGM ID')
        ids.add(track['id'])
        variants=track['variants']
        if not variants or track['default_variant'] not in {v['id'] for v in variants}: raise ValueError('Invalid BGM versions')
        for v in variants:
            p=root/v['path']
            if not p.is_file() or hashlib.sha256(p.read_bytes()).hexdigest()!=v['sha256']: raise ValueError('BGM missing or changed: '+v['path'])
            if v['duration_seconds']<=0: raise ValueError('Invalid BGM duration')
        for p in track['source_records']:
            if not (root/p).is_file(): raise ValueError('Missing BGM provenance: '+p)
        if track.get('origin')=='web':
            license=track.get('license',{})
            if not all(license.get(k) for k in ['id','url','source_url','track_url','attribution','checked_on']): raise ValueError('Missing web BGM license')
            if not (root/track.get('credit_download','')).is_file(): raise ValueError('Missing BGM credits')
        record=Path('metadata/bgm')/(track['id']+'.json')
        (root/record).parent.mkdir(parents=True,exist_ok=True)
        (root/record).write_text(json.dumps(track,ensure_ascii=False,indent=2)+'\n')
        track['record_download']=str(record)
    manifest['bgm']=tracks
    manifest['bgm_count']=len(tracks)
    manifest['bgm_version_count']=sum(len(t['variants']) for t in tracks)
    return manifest
