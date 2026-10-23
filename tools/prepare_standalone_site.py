"""Stage only approved static assets, with no dependency on Sites or credentials."""
from pathlib import Path
import json,os,runpy,re
root=Path(__file__).resolve().parents[1]
runpy.run_path(str(root/'tools/prepare_private_export.py'))
manifest=json.loads((root/'private-site/work/export/upload-manifest.json').read_text())
output=root/'deployment'/('standalone-'+manifest['release'])/'public'
output.mkdir(parents=True,exist_ok=True)
for item in manifest['files']:
    rel=Path(item['path'])
    assert not rel.is_absolute() and '..' not in rel.parts
    src=Path(item['local_path']);dest=output/rel;dest.parent.mkdir(parents=True,exist_ok=True)
    if dest.exists():dest.unlink()
    # No credential/config paths enter the inventory. Hard links avoid duplicating 9GB locally.
    os.link(src,dest)
head=(output/'index.html').read_text().split('</head>',1)[0]
for rel in re.findall(r'(?:href|src)="(gallery-[^"?]+\.(?:js|css))',head):assert (output/rel).is_file(),rel
result={'files':len(manifest['files']),'bytes':sum(x['size'] for x in manifest['files']),
        'counts':manifest['counts'],'release':manifest['release'],'standalone':True,
        'external_runtime_dependencies':[],'status':'ready_to_upload_not_deployed'}
(output.parent/'inventory.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
(output.parent/'README.txt').write_text('Vicky 资产库独立部署目录：public/。包含全部已确认素材与共用双端布局。\n无需构建；上传整个 public/，首页 index.html，保持全部相对路径。\n不包含账号、密钥、源码仓库、未确认资产。此目录尚未部署。\n后续请运行 python3 tools/prepare_standalone_site.py 重新生成并核验。\n')
print(json.dumps(result,ensure_ascii=False))
