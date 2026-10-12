"""Explicit library navigation metadata; never classify gender from image pixels."""
import json,re
from pathlib import Path

GENDERS={'male','female','other','unknown'}
def gender_from_text(text):
    t=text.lower()
    if re.search(r'\b(?:nonbinary|non-binary)\b|非二元',t):return 'other'
    f=bool(re.search(r'\b(?:female|woman|women|girl|feminine)\b|女性|女人|女孩|女角色',t))
    m=bool(re.search(r'\b(?:male|man|men|boy|masculine)\b|男性|男人|男孩|男角色',t))
    return 'female' if f and not m else 'male' if m and not f else 'unknown'

def attach_taxonomy(manifest,root):
    root=Path(root)
    config=json.loads((root/'library-taxonomy.json').read_text())
    library=json.loads((root/'character-library.json').read_text())
    extras=json.loads((root/'character-asset-config.json').read_text()).get('characters',[])
    by_id={c['id']:c for c in library['characters']+extras}
    for c in manifest['characters']:
        source=by_id[c['id']];entry=config.get('characters',{}).get(c['id'])
        if entry:
            c['gender']=entry['gender'];c['gender_source']=entry['source']
        else:
            explicit=source.get('gender')
            gender=explicit if explicit in GENDERS else gender_from_text(str(source.get('appearance',''))+' '+source.get('display_name_zh',''))
            c['gender']=gender;c['gender_source']='character setting' if gender!='unknown' else 'not specified'
    genders={c['id']:c['gender'] for c in manifest['characters']}
    for a in manifest['assets']:
        a['asset_kind']=config.get('assets',{}).get(a['path'],{}).get('asset_kind',a.get('asset_kind','character'))
        if a['asset_kind'] not in {'character','costume','scene','prop','voice','bgm'}:raise ValueError('Unknown asset kind')
        a['genders']=sorted({genders[cid] for cid in a['character_ids']}) or ['unknown']
    manifest['navigation_schema_version']=1
