"""Guard the shared responsive layer against loss during asset-library rebuilds."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[1]
css=(root/'gallery-responsive.css').read_text();js=(root/'gallery-responsive.js').read_text()
version=hashlib.sha256((css+js).encode()).hexdigest()[:12]
expected=('// Generated from ../gallery-responsive.css by tools/sync_private_ui.py.\n'
 +'export const responsiveVersion = '+json.dumps(version)+';\n'
 +'export const responsiveCSS = '+json.dumps(css)+';\n'
 +'export const responsiveJS = '+json.dumps(js)+';\n')
assert (root/'private-site/lib/gallery-responsive.ts').read_text()==expected,'Run python3 tools/sync_private_ui.py before publishing'
for name in ['index.html','build_gallery.py']:
 text=(root/name).read_text();head=text.split('</head>',1)[0]
 assert 'viewport-fit=cover' in head,name+' lacks safe-area viewport'
 assert head.rfind('gallery-responsive.css')>head.rfind('gallery-bgm.css'),name+' must load responsive CSS last'
 assert 'src="gallery-responsive.js' in text,name+' lacks responsive behavior'
print('Responsive build guard passed: shared UI, safe areas, final stylesheet and device behavior.')
