"""Check the optimized export's content/identity and loading contracts."""
import gzip
import json
from pathlib import Path
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'deployment/github-pages/public'
report=json.loads((OUT.parent/'performance.json').read_text())
html=(OUT/'index.html').read_text()
assert 'const manifest=' not in html and len(html.encode())<50_000
assert 'data-catalog="'+report['catalog']+'"' in html
catalog=json.loads((OUT/report['catalog']).read_text())
original=json.loads((OUT/'gallery-manifest.json').read_text())
assert [(a.get('id'),a['path'],a['library_number']) for a in catalog['assets']]==[(a.get('id'),a['path'],a['library_number']) for a in original['assets']]
for asset in catalog['assets']:
    assert (OUT/asset['path']).is_file()
    assert (OUT/asset['thumbnail_path']).is_file()
    full=json.loads((OUT/asset['generation']['detail_url']).read_text())
    assert full['asset_sha256']==asset['generation']['asset_sha256']
    assert full['dimensions']==asset['generation']['dimensions']
    assert full['text_to_image_prompt']
for kind in ['voices','bgm','videos']:
    assert catalog[kind]==original[kind], f'{kind} content changed'
for kind in ['application','bootstrap']:
    subprocess.run(['node','--check',str(OUT/report[kind])],check=True)
initial_bytes=sum((OUT/report[key]).stat().st_size for key in ['catalog','application','bootstrap'])+len(html.encode())
print(json.dumps({'status':'passed','assets':len(catalog['assets']),'original_media_and_identity_preserved':True,
    'first_page_limit':report['page_size'],'initial_app_and_catalog_bytes':initial_bytes,
    'catalog_gzip_bytes':len(gzip.compress((OUT/report['catalog']).read_bytes()))},ensure_ascii=False))
