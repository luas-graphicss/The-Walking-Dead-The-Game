import hashlib
import json
import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
stage = sys.argv[1] if len(sys.argv) > 1 else 'final'
if stage not in ('pre-tests', 'final'):
    raise SystemExit('Etapa inválida: use pre-tests ou final.')

output = root / 'artifacts' / f'the-walking-dead-{stage}.zip'
output.parent.mkdir(parents=True, exist_ok=True)
folders = ('app', 'components', 'lib', 'public', 'tests', 'scripts', 'assets-src')
files = ('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'next.config.mjs', 'next-env.d.ts', 'postcss.config.mjs', 'tsconfig.json', 'components.json', '.gitignore')
sources = []
for folder in folders:
    sources.extend(path for path in (root / folder).rglob('*') if path.is_file() and not path.is_symlink())
sources.extend(root / file for file in files if (root / file).is_file())
inventory = []
with ZipFile(output, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(sources):
        relative = path.relative_to(root)
        if any(part.startswith('.env') or part in ('node_modules', '__pycache__', '.next', '.git', 'artifacts') for part in relative.parts):
            continue
        if path.suffix.lower() in ('.zip', '.7z', '.tar', '.gz', '.pem', '.key', '.log', '.tsbuildinfo'):
            continue
        archive.write(path, str(Path('the-walking-dead-procedural') / relative))
        inventory.append({'path': str(relative), 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    archive.writestr('the-walking-dead-procedural/source-manifest.json', json.dumps({'format': 1, 'complete': True, 'files': inventory}, separators=(',', ':')))
with ZipFile(output) as archive:
    failed = archive.testzip()
    if failed:
        raise SystemExit(f'Integridade inválida: {failed}')

print(f'Pacote: {output}')
print(f'Arquivos: {len(sources)}')
print(f'Tamanho: {output.stat().st_size} bytes')
print(f'SHA-256: {hashlib.sha256(output.read_bytes()).hexdigest()}')
