#!/usr/bin/env python3
"""Publish and restore complete Vicky asset snapshots in the GitHub repository."""
import argparse, hashlib, json, os, shutil, subprocess, tarfile, time, threading
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = 'lyx1265897416-lab/Vicky-Asset-Repository'
MANIFEST = ROOT / 'github-content-manifest.json'
CACHE = ROOT / '.github-transfer'
EXCLUDED = {'.git', '.github-transfer', '.voice-runtime', '.voice-runtime312', '__pycache__', '.DS_Store', '.gallery-publish.lock',
            'private-site', 'mobile-site', 'deployment'}
SOURCE_DIRS = {'tools'}
LIMIT = 80 * 1024 * 1024

def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024*1024), b''): h.update(block)
    return h.hexdigest()

def run(*args, capture=False):
    for attempt in range(3):
        r = subprocess.run(args, cwd=ROOT, text=True, stdout=subprocess.PIPE if capture else None)
        if r.returncode == 0:return r.stdout if capture else None
        if attempt == 2:raise subprocess.CalledProcessError(r.returncode,args)
        print(f'Network command retry {attempt+1}/2',flush=True)
        time.sleep(10*(attempt+1))

def save(path, data):
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(path)

def eligible(path):
    return not any(p in EXCLUDED or p.endswith('.pyc') or p.startswith('.voice-runtime')
                   or p == '.env' or p.startswith('.env.') for p in path.relative_to(ROOT).parts)

def prepare(tag):
    CACHE.mkdir(exist_ok=True)
    previous = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    prior_objects = previous.get('objects', {})
    files, objects, local_sources = {}, {}, {}
    paths = []
    for directory, directories, names in os.walk(ROOT):
        directories[:] = [name for name in directories if eligible(Path(directory) / name)]
        paths.extend(Path(directory) / name for name in names
                     if eligible(Path(directory) / name) and (Path(directory) / name).is_file())
    paths.sort()
    for i, p in enumerate(paths):
        rel = p.relative_to(ROOT).as_posix()
        if rel == MANIFEST.name: continue
        n = p.stat().st_size
        # Root application files and reusable scripts are stored directly in Git.
        if len(p.relative_to(ROOT).parts) == 1 or p.relative_to(ROOT).parts[0] in SOURCE_DIRS: continue
        h = sha(p)
        files[rel] = {'sha256':h, 'size':n, 'mode':p.stat().st_mode & 0o777}
        if h not in objects:
            objects[h] = dict(prior_objects[h]) if h in prior_objects else {'size':n, 'release':tag}
            local_sources[h] = rel
        if i % 1000 == 0: print(f'Scanned {i}/{len(paths)} files', flush=True)
    batch, size, part = [], 0, 1
    for h, obj in objects.items():
        if obj.get('bundle'): continue
        if size + obj['size'] + 2048 > LIMIT and batch:
            part += 1; batch=[]; size=0
        obj['bundle'] = f'objects-{part:04d}.tar'
        batch.append(h); size += obj['size'] + 2048
    inventory = {'version':1, 'repository':REPO, 'snapshot':tag, 'created_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
                 'storage':'Application source in Git; every content file in SHA-256 verified GitHub Release object bundles.',
                 'excluded':['Local Python virtual environments, bytecode caches, macOS Finder metadata, publication lock and transfer cache.'],
                 'files':files, 'objects':objects, 'bundles':previous.get('bundles', {})}
    save(MANIFEST, inventory)
    save(CACHE/'sources.json', local_sources)
    print(json.dumps({'files':len(files),'logical_bytes':sum(x['size'] for x in files.values()),'unique_objects':len(objects),
                      'unique_bytes':sum(x['size'] for x in objects.values()),'new_bundles':len({x['bundle'] for x in objects.values() if x['release']==tag})},indent=2),flush=True)

def publish():
    inv=json.loads(MANIFEST.read_text());tag=inv['snapshot'];sources=json.loads((CACHE/'sources.json').read_text())
    releases=json.loads(run('gh','api',f'repos/{REPO}/releases',capture=True))
    release=next(r for r in releases if r['tag_name']==tag)
    remote={a['name']:a for a in release['assets']}
    inflight_path=CACHE/'inflight.json'
    inflight=json.loads(inflight_path.read_text()) if inflight_path.exists() else {}
    batches={}
    for h,o in inv['objects'].items():
        if o['release']==tag:batches.setdefault(o['bundle'],[]).append(h)
    lock=threading.Lock()
    def upload_batch(item):
        name, hashes=item
        key=f'{tag}/{name}';known=inv['bundles'].get(key)
        if known and name in remote and remote[name].get('digest')=='sha256:'+known['sha256'] and remote[name]['size']==known['size']:
            print(f'Already uploaded and recorded: {name}',flush=True);return
        pack=CACHE/name
        if name in inflight:
            pid=inflight[name]
            while True:
                try:os.kill(pid,0)
                except ProcessLookupError:break
                time.sleep(2)
            current=json.loads(run('gh','api',f'repos/{REPO}/releases/{release["id"]}',capture=True))
            remote.update({a['name']:a for a in current['assets']})
        with tarfile.open(pack,'w') as tar:
            for h in hashes:
                src=ROOT/sources[h]
                if src.stat().st_size!=inv['objects'][h]['size'] or sha(src)!=h:raise RuntimeError(f'Source changed during snapshot: {sources[h]}')
                info=tar.gettarinfo(str(src),arcname=f'objects/{h}');info.uid=info.gid=0;info.uname=info.gname='';info.mtime=0
                with src.open('rb') as f:tar.addfile(info,f)
        digest=sha(pack);n=pack.stat().st_size
        if n >= 2*1024**3:raise RuntimeError('Bundle exceeds GitHub Release file limit')
        print(f'Uploading {name}: {n/1024**2:.1f} MiB',flush=True)
        existing=remote.get(name)
        if not existing or existing.get('digest')!=f'sha256:{digest}' or existing['size']!=n:
            run('gh','release','upload',tag,str(pack),'--repo',REPO,'--clobber')
        assets=json.loads(run('gh','api',f'repos/{REPO}/releases/{release["id"]}',capture=True))['assets']
        uploaded=next(a for a in assets if a['name']==name)
        if uploaded['size']!=n or uploaded.get('digest')!=f'sha256:{digest}':raise RuntimeError(f'Remote checksum mismatch: {name}')
        with lock:
            inv['bundles'][key]={'sha256':digest,'size':n,'download_url':uploaded['browser_download_url'],'asset_id':uploaded['id']}
            save(MANIFEST,inv)
        pack.unlink()
        print(f'Verified {name} on GitHub ({len(inv["bundles"])} bundle records)',flush=True)
    small=[];large=[]
    for item in sorted(batches.items()):
        size=sum(inv['objects'][h]['size'] for h in item[1])
        (large if size > 120*1024**2 else small).append(item)
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(upload_batch,small))
    for item in large:upload_batch(item)
    run('gh','release','upload',tag,str(MANIFEST),'--repo',REPO,'--clobber')
    inflight_path.unlink(missing_ok=True)
    print('All content bundles uploaded and remote SHA-256 verified.',flush=True)

def restore():
    inv=json.loads(MANIFEST.read_text());CACHE.mkdir(exist_ok=True)
    batches={}
    for rel,record in inv['files'].items():
        target=(ROOT/rel).resolve()
        if ROOT not in target.parents:raise RuntimeError(f'Unsafe inventory path: {rel}')
        if target.is_file() and target.stat().st_size==record['size'] and sha(target)==record['sha256']:continue
        obj=inv['objects'][record['sha256']];key=f'{obj["release"]}/{obj["bundle"]}'
        batches.setdefault(key,{}).setdefault(record['sha256'],[]).append((rel,record))
    for key,wanted in sorted(batches.items()):
        tag,name=key.split('/',1);pack=CACHE/name
        print(f'Downloading {key}',flush=True)
        run('gh','release','download',tag,'--repo',REPO,'--pattern',name,'--dir',str(CACHE),'--clobber')
        if sha(pack)!=inv['bundles'][key]['sha256']:raise RuntimeError(f'Bundle checksum mismatch: {key}')
        found=set()
        with tarfile.open(pack,'r') as tar:
            for member in tar:
                h=member.name.removeprefix('objects/')
                if h not in wanted:continue
                if not member.isfile():raise RuntimeError('Expected a regular object file')
                locations=wanted[h];first=ROOT/locations[0][0];first.parent.mkdir(parents=True,exist_ok=True)
                tmp=first.with_name(first.name+'.restoring')
                with tar.extractfile(member) as src,tmp.open('wb') as dst:shutil.copyfileobj(src,dst)
                if sha(tmp)!=h:raise RuntimeError('Object checksum mismatch')
                tmp.replace(first);os.chmod(first,locations[0][1]['mode'])
                for rel,r in locations[1:]:
                    p=ROOT/rel;p.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(first,p);os.chmod(p,r['mode'])
                found.add(h)
        if found!=set(wanted):raise RuntimeError('Missing content objects')
        pack.unlink()
    print(f'Restored complete snapshot: {len(inv["files"])} content files.',flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['prepare','publish','restore']);parser.add_argument('--tag');args=parser.parse_args()
    if args.action=='prepare':
        if not args.tag:parser.error('--tag is required for prepare')
        prepare(args.tag)
    elif args.action=='publish':publish()
    else:restore()
