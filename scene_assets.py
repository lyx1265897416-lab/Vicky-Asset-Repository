"""Explicit environment identities; shared reference sheets never merge locations."""
import json
from collections import defaultdict
LABELS={'scene_original':'原始场景','scene_3d':'三维图','scene_architecture':'建筑图','scene_plan':'户型 / 场地图','scene_angles':'多角度图'}
def attach_scenes(manifest,root):
    cfg=json.loads((root/'scene-library.json').read_text())
    groups=cfg['scenes'];by={g['id']:g for g in groups};members=defaultdict(list)
    for g in groups:
        for p in g['anchors']:members[p].append(g['id'])
    present=defaultdict(list)
    for a in manifest['assets']:
        if a.get('asset_kind')!='scene':continue
        ids=members.get(a['path']) or a.get('scene_ids',[])
        a['scene_ids']=[i for i in ids if i in by]
        a['scene_names']=[by[i]['name'] for i in a['scene_ids']]
        v=a.get('scene_view','scene_original')
        a['scene_view']=v;a['view_label']=LABELS[v];a['view_type']=v
        for i in a['scene_ids']:present[i].append(a)
    manifest['scenes']=[{**g,'asset_paths':[a['path'] for a in present[g['id']]],'coverage':{v:sum(a['scene_view']==v for a in present[g['id']]) for v in LABELS}} for g in groups if present[g['id']]]
    manifest['scene_standard']={'views':LABELS,'required':cfg['requested_types'],'geometry_note':'依据原图补充的概念空间设计，未展示区域为合理推演。'}
