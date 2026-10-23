"""Sync the shared responsive UI into the hosted source without reuploading assets."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[1]
css=(root/'gallery-responsive.css').read_text()
js=(root/'gallery-responsive.js').read_text()
version=hashlib.sha256((css+js).encode()).hexdigest()[:12]
(root/'private-site/lib/gallery-responsive.ts').write_text(
    '// Generated from ../gallery-responsive.css by tools/sync_private_ui.py.\n'
    +'export const responsiveVersion = '+json.dumps(version)+';\n'
    +'export const responsiveCSS = '+json.dumps(css)+';\n'
    +'export const responsiveJS = '+json.dumps(js)+';\n')
print('Shared responsive UI synchronized: '+version)
