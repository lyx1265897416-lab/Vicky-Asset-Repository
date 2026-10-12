"""Character membership comes from explicit references, never face similarity or shared numbering."""
import json
from pathlib import Path

VIEW_LABELS = {'prop':'道具图','full_body':'单人全身照','expression_grid':'九宫格表情','head_angles':'头部多角度','instance':'实例图','front':'正视图','face_turnaround':'脸部三视图','body_turnaround':'全身三视图','outfit':'完整造型','costume':'服装图','accessory':'配饰单品','expression':'表情图','pose':'动作图','detail':'细节图','character_board':'角色组图','relationship':'关系图','pov':'场景实例','style_reference':'风格参考'}

def attach_character_assets(manifest, root):
    root = Path(root)
    library = json.loads((root/'character-library.json').read_text())
    config = json.loads((root/'character-asset-config.json').read_text())
    from asset_additions import membership_additions
    additions = membership_additions(root)
    characters = library['characters'] + config.get('characters', [])
    by_id = {c['id']: c for c in characters}
    if len(by_id) != len(characters):
        raise ValueError('Duplicate character ID')
    memberships = {}
    for c in characters:
        for path in set(c.get('reference_assets', []) + ([c['identity_anchor']] if c.get('identity_anchor') else [])):
            memberships.setdefault(path, []).append(c['id'])
    used = set()
    for a in manifest['assets']:
        override = {**additions.get(a['path'], {}), **config.get('assets', {}).get(a['path'], {})}
        ids = override.get('character_ids', memberships.get(a['path'], memberships.get(a.get('id'), [])))
        if any(cid not in by_id for cid in ids):
            raise ValueError('Unknown character in ' + a['path'])
        a['character_ids'] = list(dict.fromkeys(ids))
        a['character_names'] = [by_id[cid].get('display_name_zh', cid) for cid in a['character_ids']]
        used.update(ids)
        view = a['category']
        if view == 'identity':
            view = 'front' if ('正面平视' in a['title'] or '/front-id' in a['path'] or '/western-male-front-id' in a['path']) else 'instance'
        view = override.get('view_type', view)
        if view not in VIEW_LABELS:
            raise ValueError('Unknown asset view ' + view)
        a['view_type'] = view
        a['view_label'] = VIEW_LABELS[view]
        a['membership_status'] = 'assigned' if ids else 'unassigned'
    manifest['characters'] = [{'id':c['id'],'name':c.get('display_name_zh',c['id']),'project':c.get('source_project',''),'asset_paths':[a['path'] for a in manifest['assets'] if c['id'] in a['character_ids']]} for c in characters if c['id'] in used]
    manifest['character_asset_schema_version'] = 1
    from identity_consistency import validate_identity_membership
    validate_identity_membership(manifest['assets'], root)
    return manifest
