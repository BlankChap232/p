#!/usr/bin/env python3
"""Reconstruct tested PandaTV 2.0.7 UI changes from the exact public 2.0.5 APK.
Outputs an unsigned APK. Signing credentials are never accessed here.
"""
import argparse
import hashlib
import json
import struct
import subprocess
import tarfile
import tempfile
import zipfile
from pathlib import Path

PROD_SHA = '10c3e2a0d1c91a546050a7e861caefd1b50e004b79e1e51a7cd437965cb88a9e'
TEST_SHA = '0880696408c8d657067d728bc95552f33ce2cf8008860ef5d5d7414cfbc8e024'
HTML_MARKER = b'<!-- Panda Tv Elite 2.0.7 - stable remote navigation and vertical scroll rail -->\n<link rel="stylesheet" href="panda_remote_nav_v207.css"><script src="panda_remote_nav_v207.js"></script>\n'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def exactly(data, old, new, description):
    count = data.count(old)
    if count != 1:
        raise ValueError(f'{description}: expected exactly one match, found {count}')
    if len(old) != len(new) and description in ('versionName', 'applicationId'):
        raise ValueError(f'{description}: length changed unexpectedly')
    return data.replace(old, new, 1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', required=True, type=Path)
    parser.add_argument('--bundle', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--mode', choices=('production', 'qa-replay'), default='production')
    args = parser.parse_args()
    if args.base.resolve() == args.out.resolve():
        raise ValueError('Input APK and output APK must differ')
    expected_sha = PROD_SHA if args.mode == 'production' else TEST_SHA
    actual_sha = sha(args.base.read_bytes())
    if actual_sha != expected_sha:
        raise ValueError(f'Unexpected 2.0.5 base APK SHA-256: {actual_sha}')
    with tarfile.open(args.bundle, 'r:xz') as tar:
        names = [m.name for m in tar.getmembers()]
        if any(n.startswith('/') or '..' in Path(n).parts for n in names):
            raise ValueError('Unsafe archive paths')
        data = {n: tar.extractfile(n).read() for n in names if tar.getmember(n).isfile()}
    meta = json.loads(data['checksums.json'])
    modified = meta['modified']
    rename_old, rename_new = meta['rename']
    patched = {}
    with zipfile.ZipFile(args.base) as src, tempfile.TemporaryDirectory() as tmp:
        if src.testzip() is not None:
            raise ValueError('Base APK failed archive integrity check')
        for source, target in [(a, a) for a in modified] + [(rename_old, rename_new)]:
            old_bytes = src.read(source)
            if sha(old_bytes) != meta['expected_before'][source]:
                raise ValueError(f'Unexpected original asset checksum: {source}')
            original = Path(tmp) / 'old'
            result = Path(tmp) / 'new'
            original.write_bytes(old_bytes)
            patch_bytes = data['patches/' + Path(source).name + '.patch']
            p = subprocess.run(
                ['patch', '--batch', '--silent', '--fuzz=0', '-o', str(result), str(original)],
                input=patch_bytes, capture_output=True)
            if p.returncode:
                raise ValueError(f'Patch failed for {source}: {p.stderr.decode(errors="replace")}')
            new_bytes = result.read_bytes()
            if sha(new_bytes) != meta['expected_after'][target]:
                raise ValueError(f'Unexpected patched asset checksum: {target}')
            patched[target] = new_bytes
            result.unlink()
        for name in meta['added']:
            blob = data['new/' + name]
            if sha(blob) != meta['expected_after'][name]:
                raise ValueError(f'Unexpected new asset checksum: {name}')
            patched[name] = blob
        html = src.read('assets/pandatv.html')
        html = exactly(
            html, b'<script src="panda_smart_guide_v205.js"></script>',
            b'<script src="panda_smart_guide_v206.js"></script><script src="panda_perf_guard_v206.js"></script>', '206 loader')
        html = exactly(html, b'</body></html>', HTML_MARKER + b'</body></html>', '207 loader')
        patched['assets/pandatv.html'] = html
        manifest = src.read('AndroidManifest.xml')
        old_name = '2.0.5-stable' if args.mode == 'production' else '2.0.5-qa0001'
        new_name = '2.0.7-stable' if args.mode == 'production' else '2.0.7-qa0001'
        if args.mode == 'production' and 'com.pandatv.elitev301.elite204'.encode('utf-16le') not in manifest:
            raise ValueError('Production applicationId mismatch')
        manifest = exactly(manifest, old_name.encode('utf-16le'), new_name.encode('utf-16le'), 'versionName')
        manifest = exactly(manifest, struct.pack('<I', 2050), struct.pack('<I', 2070), 'versionCode')
        patched['AndroidManifest.xml'] = manifest
        with zipfile.ZipFile(args.out, 'w', allowZip64=True) as dst:
            for info in src.infolist():
                name = info.filename
                if name == rename_old:
                    continue
                if name.startswith('META-INF/') and (name == 'META-INF/MANIFEST.MF' or name.endswith(('.RSA', '.DSA', '.EC', '.SF'))):
                    continue
                content = patched.pop(name, None)
                if content is None:
                    content = src.read(name)
                zi = zipfile.ZipInfo(name, info.date_time)
                zi.compress_type = info.compress_type
                zi.external_attr = info.external_attr
                zi.internal_attr = info.internal_attr
                zi.create_system = info.create_system
                zi.comment = info.comment
                if name.endswith('.so') and zi.compress_type == zipfile.ZIP_STORED:
                    offset = dst.fp.tell() + 30 + len(name.encode('utf-8'))
                    pad = (4096 - ((offset + 4) % 4096)) % 4096 + 4
                    zi.extra = struct.pack('<HH', 0xFFFE, pad - 4) + bytes(pad - 4)
                dst.writestr(zi, content, compress_type=zi.compress_type, compresslevel=6)
            for name, content in patched.items():
                dst.writestr(name, content, compress_type=zipfile.ZIP_DEFLATED, compresslevel=6)
    with zipfile.ZipFile(args.base) as old, zipfile.ZipFile(args.out) as new:
        if new.testzip() is not None:
            raise ValueError('Reconstructed APK failed integrity check')
        protected = [n for n in old.namelist() if n.endswith(('.dex', '.so'))]
        if sum(n.endswith('.dex') for n in protected) != 5 or sum(n.endswith('.so') for n in protected) != 10:
            raise ValueError('Unexpected protected native-file counts')
        for name in protected:
            if sha(old.read(name)) != sha(new.read(name)):
                raise ValueError(f'Protected playback library changed: {name}')
        for info in new.infolist():
            if info.filename.endswith('.so') and info.compress_type == zipfile.ZIP_STORED:
                with args.out.open('rb') as f:
                    f.seek(info.header_offset + 26)
                    length_name, length_extra = struct.unpack('<HH', f.read(4))
                if (info.header_offset + 30 + length_name + length_extra) % 4096:
                    raise ValueError(f'Native library not aligned: {info.filename}')
        if b'panda_remote_nav_v207.js' not in new.read('assets/pandatv.html'):
            raise ValueError('Missing 207 navigation loader')
    print('PASS: verified assets, 5 DEX, 10 native libraries, native library 4K alignment')
    print('UNSIGNED 2.0.7 SHA-256:', sha(args.out.read_bytes()))


if __name__ == '__main__':
    main()
