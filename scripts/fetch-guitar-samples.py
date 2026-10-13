"""Fetch the pinned, GPL-licensed Warm note recordings (not Guitoro's code).

Run from any directory with Python 3. The checked-in manifest pins filenames.
Synthesized noise assets have separate provenance and are deliberately excluded.
"""
import concurrent.futures
import hashlib
import json
import subprocess
from pathlib import Path

destination = Path(__file__).resolve().parents[1] / 'public/samples/acoustic-seagull'
manifest = json.loads((destination / 'manifest.json').read_text())
base = 'https://guitoro.com/samples/acoustic-seagull/'
files = sorted({name + extension for zone in manifest['zones']
                for layer in zone['layers'] for name in layer['files']
                for extension in ('.ogg', '.m4a')})


def fetch(name):
    path = destination / name
    if not path.exists():
        data = subprocess.check_output(['curl', '--fail', '--silent', '--show-error',
                                        '--location', '--max-time', '45', '--retry', '2', base + name])
        expected = b'OggS' if name.endswith('.ogg') else b'ftyp'
        if expected not in data[:16]:
            raise ValueError(f'Unexpected audio format: {name}')
        temporary = path.with_suffix(path.suffix + '.tmp')
        temporary.write_bytes(data)
        temporary.replace(path)
    return name, hashlib.sha256(path.read_bytes()).hexdigest()


with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    hashes = dict(pool.map(fetch, files))
(destination / 'SHA256SUMS').write_text(''.join(f'{digest}  {name}\n' for name, digest in sorted(hashes.items())))
print(f'Verified {len(hashes)} recordings, {sum((destination / name).stat().st_size for name in files):,} bytes')
