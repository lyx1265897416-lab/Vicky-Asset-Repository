"""Persistent removal of confirmed gallery copies; never unlink source project files."""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

STATE_FILE = 'permanently-deleted-assets.json'

def load_deleted(root):
    p=Path(root)/STATE_FILE
    return json.loads(p.read_text()) if p.exists() else {'version':1,'assets':{}}

def write_json(path, data):
    tmp=path.with_name(path.name+'.tmp')
    tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    os.replace(tmp,path)

def deleted_keys(root):
    entries=load_deleted(root)['assets']
    return set(entries)|{v['path'] for v in entries.values()}

def filter_deleted(manifest, root):
    keys=deleted_keys(root)
    manifest['assets']=[a for a in manifest['assets'] if a['path'] not in keys and a.get('id',a['path']) not in keys]
    manifest['asset_count']=len(manifest['assets'])
    return manifest

def managed_path(root, relative, prefix='assets'):
    root=Path(root).resolve();p=root/relative
    if not isinstance(relative,str) or not relative.startswith(prefix+'/') or '..' in Path(relative).parts:
        raise ValueError('不允许删除图库以外的文件')
    if p.is_symlink() or not p.resolve().is_relative_to(root/prefix):
        raise ValueError('不允许删除外部文件或软链接')
    return p

def _purge_assets(root, ids):
    root=Path(root)
    if not isinstance(ids,list) or not ids or len(ids)>2000 or any(not isinstance(i,str) for i in ids):
        raise ValueError('请选择要彻底删除的图片')
    ids=list(dict.fromkeys(ids))
    m=json.loads((root/'gallery-manifest.json').read_text())
    known={a.get('id',a['path']):a for a in m['assets']}
    state=load_deleted(root);entries=state['assets'];pending={};targets=[]
    # Validate the entire batch before recording or removing anything.
    for key in ids:
        a=known.get(key) or entries.get(key)
        if not a:raise ValueError('图片不存在或图库已更新，请刷新后重试')
        image=managed_path(root,a['path'])
        candidates=[image]
        if key!=a['path'] and key not in {x['path'] for x in m['assets']}:
            candidates.append(managed_path(root,key))
        record=managed_path(root,str(Path('metadata/records')/Path(a['path']).with_suffix('.txt')),'metadata/records')
        candidates.append(record)
        if any(p.exists() and not p.is_file() for p in candidates):raise ValueError('图片路径不是文件')
        targets.extend(candidates)
        pending[key]={'path':a['path'],'title':a.get('title',''),'deleted_at':entries.get(key,{}).get('deleted_at',datetime.now(timezone.utc).isoformat()),'status':'pending'}
    entries.update(pending)
    # Persist first: an interrupted operation can be retried and cannot be reimported by sync.
    write_json(root/STATE_FILE,state)
    for target in set(targets):target.unlink(missing_ok=True)
    for key in ids:entries[key]['status']='complete'
    write_json(root/STATE_FILE,state)
    m=filter_deleted(m,root)
    for c in m.get('characters',[]):c['asset_paths']=[p for p in c['asset_paths'] if p in {a['path'] for a in m['assets']}]
    m['characters']=[c for c in m.get('characters',[]) if c['asset_paths']]
    write_json(root/'gallery-manifest.json',m)
    return ids

def completed_deleted_keys(root):
    entries={k:v for k,v in load_deleted(root)['assets'].items() if v.get('status','complete')=='complete'}
    return set(entries)|{v['path'] for v in entries.values()}


def purge_assets(root, ids):
    from gallery_lock import gallery_lock
    with gallery_lock(root):
        return _purge_assets(root, ids)
