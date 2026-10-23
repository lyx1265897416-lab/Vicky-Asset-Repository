"""Prepare an immutable, approved-only export for the private hosted gallery."""
from pathlib import Path
import hashlib,json,mimetypes,re,runpy
from compact_gallery_export import compact_export
ROOT=Path(__file__).resolve().parents[1]
runpy.run_path(str(ROOT/'tools/sync_private_ui.py'))
runpy.run_path(str(ROOT/'tools/check_responsive_ui.py'))
OUT=ROOT/'private-site/work/export'
OUT.mkdir(parents=True,exist_ok=True)
m=json.loads((ROOT/'gallery-manifest.json').read_text())
previous_path=OUT/'upload-manifest.json'
previous_time=previous_path.stat().st_mtime if previous_path.exists() else 0
previous={f['path']:f for f in json.loads(previous_path.read_text()).get('files',[])} if previous_path.exists() else {}
paths=set()
progress=m.get('asset_standard',{}).get('progress_path')
if progress and (ROOT/progress).is_file():paths.add(progress)
for a in m['assets']:
    paths.add(a['path'])
    record=a.get('generation',{}).get('record_download') or (Path('metadata/records')/Path(a['path']).with_suffix('.txt')).as_posix()
    if (ROOT/record).is_file():paths.add(record)
    paths.update(v for v in (a.get('spatial_attachments') or {}).values() if isinstance(v,str) and (ROOT/v).is_file())
for v in m.get('voices',[]):
    paths.update(v[k] for k in ['path','record_download','confirmation_evidence'] if v.get(k))
    if (v.get('commercial_license') or {}).get('record'):paths.add(v['commercial_license']['record'])
for b in m.get('bgm',[]):
    paths.update(v['path'] for v in b['variants'])
    paths.update(b[k] for k in ['record_download','credit_download'] if b.get(k))
for video in m.get('videos',[]):
    paths.update(video[k] for k in ['path','poster','record_download'])
    paths.add(video['reuse_pack']['path'])
    if video.get('playback'):paths.add(video['playback']['path'])
html=(ROOT/'index.html').read_text()
css='''<style id="private-library-viewer">#video-detail-delete,#detail-delete,#detail-purge,#bulk-delete,#bulk-purge,#empty-trash,.recycle-shortcut,[data-value="trash"],[data-action="delete"],[data-action="restore"],[data-action="purge"]{display:none!important}</style><meta name="robots" content="noindex,nofollow,noarchive">'''
html=html.replace('</head>',css+'</head>',1)
html=re.sub(r'<div class="footer">.*?</div>', '<div class="footer">Vicky 资产库 · 只读浏览 · 访问范围由所有者设置</div>',html,flags=re.S)
html,detail_files=compact_export(html,OUT)
(OUT/'index.html').write_text(html)
paths.update(re.findall(r'(?:src|href)="(gallery-[^"?]+\.(?:js|css))(?:\?[^\"]*)?"',html))
paths.add('gallery-manifest.json')
paths.update(path.relative_to(OUT).as_posix() for path in detail_files)
files=[]
for path in sorted(paths|{'index.html'}):
    relative=Path(path)
    if relative.is_absolute() or '..' in relative.parts:raise ValueError('Invalid export path')
    source=OUT/path if path=='index.html' or path.startswith('metadata/details/') else ROOT/path
    if not source.is_file():raise FileNotFoundError(path)
    prior=previous.get(path)
    if prior and prior['size']==source.stat().st_size and source.stat().st_mtime<=previous_time:
        sha=prior['sha256']
    else:
        digest=hashlib.sha256()
        with source.open('rb') as f:
            while chunk:=f.read(4*1024*1024):digest.update(chunk)
        sha=digest.hexdigest()
    mime=mimetypes.guess_type(path)[0] or 'application/octet-stream'
    if path.endswith('.js'):mime='application/javascript; charset=utf-8'
    elif path.endswith(('.html','.txt','.css','.json')):mime+='; charset=utf-8'
    files.append(dict(path=path,local_path=str(source),sha256=sha,size=source.stat().st_size,type=mime))
release=hashlib.sha256(json.dumps([(f['path'],f['sha256']) for f in files]).encode()).hexdigest()[:24]
result=dict(release=release,counts=dict(images=len(m['assets']),voices=len(m.get('voices',[])),music=len(m.get('bgm',[])),videos=len(m.get('videos',[]))),files=files)
(OUT/'upload-manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(release=release,files=len(files),bytes=sum(f['size'] for f in files),counts=result['counts'])))
