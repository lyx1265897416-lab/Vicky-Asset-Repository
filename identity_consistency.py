"""Provenance guard: role identity is explicit, never inferred from face recognition."""
from pathlib import Path

def validate_identity_membership(assets, root):
    root = Path(root)
    by_path = {a['path']: a for a in assets}
    errors = []
    for asset in assets:
        ids = set(asset.get('character_ids', []))
        if not ids:
            continue
        generation = asset.get('generation', {})
        ref = generation.get('identity_reference')
        if isinstance(ref, str):
            path = Path(ref)
            if path.is_absolute():
                try:
                    ref = path.relative_to(root).as_posix()
                except ValueError:
                    ref = None
            source = by_path.get(ref)
            if source and source.get('character_ids') and ids.isdisjoint(source['character_ids']):
                errors.append(f"{asset['path']}: 身份参考属于其他角色：{ref}")
        if generation.get('source_type') == 'generated_portrait_redesign':
            others = [a for a in assets if a is not asset and ids.intersection(a.get('character_ids', []))]
            if others:
                errors.append(f"{asset['path']}: 独立重设计图不可直接混入已有角色资产；请为新设计建立独立角色，或先完成整套身份一致性迁移")
    if errors:
        raise ValueError('角色身份关联校验失败：\n' + '\n'.join(errors))
