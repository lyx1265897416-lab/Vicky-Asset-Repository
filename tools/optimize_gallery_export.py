"""Optimize an approved static export without changing its catalogue membership."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def optimize(directory, source_index=None):
    html=(source_index or directory/'index.html').read_text()
    start=html.index('const manifest=')+len('const manifest=')
    end=html.index(';\nconst assets=manifest.assets;',start)
    manifest=json.loads(html[start:end])
    before=len(html.encode())
    original_ids=[a.get('id') or a['path'] for a in manifest['assets']]

    def thumbnail(asset):
        src=directory/asset['path']
        name=hashlib.sha256(asset['path'].encode()).hexdigest()[:24]
        relative=f'web/thumbs/{name}-400.webp'
        target=directory/relative;target.parent.mkdir(parents=True,exist_ok=True)
        if not target.exists():
            with Image.open(src) as image:
                image.thumbnail((400,400),Image.Resampling.LANCZOS)
                image.save(target,'WEBP',quality=72,method=4)
        return relative

    unique={a['path']:a for a in manifest['assets']}
    with ThreadPoolExecutor(max_workers=4) as pool:
        thumbs=dict(zip(unique,pool.map(thumbnail,unique.values())))
    for asset in manifest['assets']:
        asset['thumbnail_path']=thumbs[asset['path']]
        g=asset['generation']
        # The complete, original generation record is still fetched on opening details.
        asset['generation']={key:g[key] for key in ['asset_sha256','dimensions','generation_date',
            'generation_timezone','generation_date_note','source_type','prompt_kind','record_download','detail_url'] if key in g}
        asset['generation'].update(model={'display_name':g['model']['display_name']},
            text_to_image_prompt='正在加载完整提示词…',reproduction_note='')
    manifest['characters']=[{k:c[k] for k in ['id','name','project','completion_round','gender'] if k in c}
                            for c in manifest['characters']]
    manifest['scenes']=[{k:s[k] for k in ['id','name','style_family'] if k in s} for s in manifest.get('scenes',[])]
    assert original_ids==[a.get('id') or a['path'] for a in manifest['assets']]
    payload=json.dumps(manifest,ensure_ascii=False,separators=(',',':')).encode()
    data_path='web/catalog-'+hashlib.sha256(payload).hexdigest()[:16]+'.json'
    (directory/data_path).write_bytes(payload)

    html=html[:start]+'window.__galleryManifest'+html[end:]
    scripts=re.findall(r'<script\b([^>]*)>(.*?)</script>',html,re.S)
    pieces=[(ROOT/'gallery-performance.js').read_text()]
    for attributes,inline in scripts:
        src=re.search(r'src="([^"?]+)',attributes)
        code=(directory/src[1]).read_text() if src else inline
        if src and src[1]=='gallery-characters.js':
            code=code.replace('const characterById=()=>new Map(manifest.characters.map(c=>[c.id,c]));',
                'const characterById=(()=>{let map;return()=>map||(map=new Map(manifest.characters.map(c=>[c.id,c])));})();')
            code=code.replace('function characterGridHTML(list,card){','function characterGridHTML(list,card){list=galleryPageItems(list);')
            code=code.replace('return manifest.asset_standard.slots.every(s=>assets.some(', 'return manifest.asset_standard.slots.every(s=>galleryRoleAssets(c.id).some(')
            code=code.replace("assets.some(a=>a.character_ids.includes(c.id)&&(activeCollection==='trash'?isTrashed(a):!isTrashed(a)))", "galleryRoleAssets(c.id).some(a=>activeCollection==='trash'?isTrashed(a):!isTrashed(a))")
            code=code.replace("assets.filter(a=>a.character_ids.includes(c.id)&&(activeCollection==='trash'?isTrashed(a):!isTrashed(a)))", "galleryRoleAssets(c.id).filter(a=>activeCollection==='trash'?isTrashed(a):!isTrashed(a))")
            code=code.replace('return assets.filter(a=>a.character_ids.includes(id)&&!isTrashed(a))', 'return galleryRoleAssets(id).filter(a=>!isTrashed(a))')
        if not src:
            code=code.replace("const hay=(a.title+' '+a.source+' '+a.category+' '+(a.scene_names||[]).join(' ')+' '+a.character_names.join(' ')+' '+a.view_label).toLowerCase();",'const hay=gallerySearchHay(a);')
            code=code.replace(';initPermanentDelete();',';')
        if src and src[1] in ['gallery-voices.js','gallery-bgm.js','gallery-videos.js']:
            kind={'gallery-voices.js':'voice','gallery-bgm.js':'bgm','gallery-videos.js':'video'}[src[1]]
            declaration=f'const list={kind}List()'
            assert code.count(declaration)==1, f'{kind} rendering contract changed; review pagination adapter'
            code=code.replace(declaration,f'const allItems={kind}List();const list=galleryPageItems(allItems)',1)
            code=code.replace('${list.length} /', '${allItems.length} /')
            code=code.replace('preload="metadata"','preload="none"') if kind=='voice' else code
            if kind=='voice':
                code=code.replace("audio.preload='auto';", "audio.preload='none';")
                code=code.replace('if(audio.paused&&audio.readyState<2)audio.load();','')
        if src and src[1]=='gallery-bulk.js':
            code=code.replace('const items=batchList();','const items=galleryPageItems(batchList());')
        # Only image tags use the small copy. Modal/download URLs retain the larger file.
        code=re.sub(r'(<img\b[^>]*src="\$\{escapeHTML\()assetURL\(',r'\1galleryThumbURL(',code)
        code=code.replace('<img loading="lazy"','<img decoding="async" loading="lazy"')
        pieces.append(code)
    pieces.append('installGalleryPerformance();\n')
    app='\n;\n'.join(pieces).encode()
    app_path='web/app-'+hashlib.sha256(app).hexdigest()[:16]+'.js'
    (directory/app_path).write_bytes(app)
    html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S)
    css='''<style>#gallery-pager{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;margin:24px 0}#gallery-pager[hidden]{display:none}#gallery-pager span{width:100%;text-align:center;color:#70685f;font-size:13px}#gallery-pager button,#gallery-load-retry{min-height:44px;padding:8px 18px;border:1px solid #d7d0c6;background:#fff;border-radius:9px;cursor:pointer}#gallery-pager button:disabled{opacity:.4;cursor:default}.card{content-visibility:auto;contain-intrinsic-size:auto 360px}#gallery-loading{padding:12px 0;color:#70685f}</style>'''
    html=html.replace('</head>',css+f'<link rel="preload" as="fetch" crossorigin href="{data_path}"><link rel="preload" as="script" href="{app_path}"></head>',1)
    html=html.replace('<div class="controls"', '<div id="gallery-loading" role="status">正在加载资产目录…<button id="gallery-load-retry" hidden>重新加载</button></div><div class="controls"',1)
    bootstrap=(ROOT/'gallery-bootstrap.js').read_text()
    bootstrap_path='web/start-'+hashlib.sha256(bootstrap.encode()).hexdigest()[:16]+'.js'
    (directory/bootstrap_path).write_text(bootstrap)
    html=html.replace('</body>',f'<script defer src="{bootstrap_path}" data-catalog="{data_path}" data-app="{app_path}"></script></body>',1)
    (directory/'index.html').write_text(html)
    report={'before_html_bytes':before,'after_html_bytes':len(html.encode()),'catalog_bytes':len(payload),
        'application_bytes':len(app),'assets':len(manifest['assets']),'page_size':48,
        'catalog':data_path,'application':app_path,'bootstrap':bootstrap_path,
        'thumbnail_files':len(thumbs),'thumbnail_bytes':sum((directory/p).stat().st_size for p in thumbs.values())}
    (directory.parent/'performance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--directory',type=Path,default=ROOT/'deployment/github-pages/public');parser.add_argument('--source-index',type=Path)
    args=parser.parse_args();print(json.dumps(optimize(args.directory,args.source_index),ensure_ascii=False))
