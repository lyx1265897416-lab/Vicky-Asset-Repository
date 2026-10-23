"""Keep hosted first paint independent of full image-generation records."""
from pathlib import Path
import hashlib
import json


def compact_export(html: str, output: Path) -> tuple[str, list[Path]]:
    start = html.index('const manifest=') + len('const manifest=')
    end = html.index(';\nconst assets=manifest.assets;', start)
    manifest = json.loads(html[start:end])
    details = output / 'metadata/details'
    details.mkdir(parents=True, exist_ok=True)
    generated = []
    summary_keys = {
        'asset_sha256', 'dimensions', 'generation_date', 'generation_timezone',
        'generation_date_note', 'source_type', 'model', 'prompt_kind',
        'record_download', 'prompt_prepared_on', 'reproduction_note',
    }
    for asset in manifest['assets']:
        full = asset['generation']
        body = json.dumps(full, ensure_ascii=False, separators=(',', ':')) + '\n'
        digest = hashlib.sha256(body.encode()).hexdigest()
        target = details / (digest + '.json')
        target.write_text(body)
        generated.append(target)
        asset['generation'] = {key: value for key, value in full.items() if key in summary_keys}
        asset['generation'].update(
            detail_url=target.relative_to(output).as_posix(),
            text_to_image_prompt='正在加载完整提示词…',
        )
    payload = json.dumps(manifest, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    html = html[:start] + payload + html[end:]
    script = Path(__file__).resolve().parents[1] / 'gallery-lazy-details.js'
    version = hashlib.sha256(script.read_bytes()).hexdigest()[:12]
    html = html.replace('</body>', f'<script src="gallery-lazy-details.js?v={version}"></script>\n</body>', 1)
    return html, generated
