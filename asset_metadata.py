"""Validate image provenance before publishing the confirmed gallery."""
import hashlib
import json
from datetime import date
from pathlib import Path


def attach_generation_metadata(assets, root=None):
    root = Path(root or Path(__file__).resolve().parent)
    ledger = json.loads((root / 'asset-generation-metadata.json').read_text())['assets']
    from asset_additions import metadata_additions
    for path, record in metadata_additions(root).items():
        if path in ledger and ledger[path] != record:
            raise ValueError('Conflicting generation records: ' + path)
        ledger[path] = record
    errors = []
    for asset in assets:
        path = asset['path']
        record = ledger.get(path)
        if not record:
            errors.append(f'{path}: 缺少生成信息，请补入 asset-generation-metadata.json')
            continue
        if record.get('asset_path') != path:
            errors.append(f'{path}: 元数据路径不匹配')
        if len(record.get('text_to_image_prompt', '').strip()) < 80:
            errors.append(f'{path}: 缺少完整的独立文生图提示词')
        if record.get('prompt_kind') not in ('original_text_to_image', 'reconstructed_text_to_image'):
            errors.append(f'{path}: 必须区分原始提示词与重建提示词')
        dimensions = record.get('dimensions', {})
        if not all(isinstance(dimensions.get(k), int) and dimensions[k] > 0 for k in ('width', 'height')):
            errors.append(f'{path}: 缺少实际图片尺寸')
        for field in ('prompt_prepared_on', 'reproduction_note', 'source_type'):
            if not record.get(field):
                errors.append(f'{path}: 缺少 {field}')
        model = record.get('model', {})
        if not model.get('display_name') or model.get('status') not in ('verified', 'not_exposed', 'unknown'):
            errors.append(f'{path}: 缺少模型名称或明确的未知状态')
        status = record.get('generation_date_status')
        if status not in ('verified_generation_event', 'verified_parent_generation', 'unknown'):
            errors.append(f'{path}: 缺少生成日期来源状态')
        if status == 'unknown':
            if record.get('generation_date') or not record.get('generation_date_note'):
                errors.append(f'{path}: 未知日期必须留空并说明原因')
        else:
            try:
                date.fromisoformat(record['generation_date'])
                if not record.get('generation_timezone') or not record.get('evidence'):
                    raise ValueError('missing provenance')
            except (KeyError, TypeError, ValueError):
                errors.append(f'{path}: 已核实日期缺少有效日期、时区或依据')
        image = root / path
        if not image.is_file() or hashlib.sha256(image.read_bytes()).hexdigest() != record.get('asset_sha256'):
            errors.append(f'{path}: 图片已改变或缺失，必须重新核对生成信息')
        for evidence in record.get('evidence', []):
            if not (root / evidence).is_file():
                errors.append(f'{path}: 依据文件缺失 {evidence}')
        asset['generation'] = record
        # Keep saved favorites/trash linked when an uploaded replacement changes format.
        if record.get('stable_asset_id'):
            asset['id'] = record['stable_asset_id']
    if errors:
        raise ValueError('图库未更新：\n' + '\n'.join(errors))
    return assets
