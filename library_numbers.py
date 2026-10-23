"""Persistent per-category display numbers; deleted numbers are never reused."""
import json
from pathlib import Path

def attach_numbers(manifest, root):
    path=Path(root)/'library-numbers.json'
    registry=json.loads(path.read_text()) if path.exists() else {'version':1,'categories':{}}
    groups={k:[] for k in ['character','costume','scene','prop','voice','bgm','video']}
    for item in manifest['assets']:
        groups[item['asset_kind']].append(('image:'+str(item.get('id') or item['path']),item))
    role_order={c['id']:i for i,c in enumerate(manifest.get('characters',[]))}
    groups['character'].sort(key=lambda pair:min((role_order.get(cid,len(role_order)) for cid in pair[1].get('character_ids',[])),default=len(role_order)))
    groups['costume'].sort(key=lambda pair: {'outfit':0,'costume':1,'accessory':2}.get(pair[1]['category'],3))
    for kind,key in [('voice','voices'),('bgm','bgm'),('video','videos')]:
        groups[kind].extend((kind+':'+item['id'],item) for item in manifest.get(key,[]))
    for kind,items in groups.items():
        numbers=registry['categories'].setdefault(kind,{})
        if len(set(numbers.values()))!=len(numbers) or any(type(n)!=int or n<1 for n in numbers.values()):
            raise ValueError('Invalid numbering registry: '+kind)
        next_number=max(numbers.values(),default=0)+1
        for key,item in items:
            if key not in numbers:
                numbers[key]=next_number;next_number+=1
            item['library_number']=numbers[key]
    temp=path.with_suffix('.json.tmp');temp.write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n');temp.replace(path)
    manifest['numbering_policy']={'scope':'per_category','start':1,'stable':True,'registry':'library-numbers.json'}
