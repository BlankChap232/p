#!/usr/bin/env python3
"""Patch the verified public 2.0.7 APK with exactly the user-tested 2.0.11 QA UI assets.

The distribution artifact is NEVER the QA APK: this produces an unsigned production
APK that must pass zipalign, owner signing, certificate equality, and APK checks.
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

EXPECTED_PROD_BASE = 'c07a2ca64f33462afbda4b14506fcaa758a65801ece9e24d051d5efddaa29862'
EXPECTED_PROD_PACKAGE = 'com.pandatv.elitev301.elite204'
OLD_VERSION = '2.0.7-stable'
NEW_VERSION = '2.0.11-final'  # 12-character binary manifest string-pool replacement
OLD_CODE, NEW_CODE = 2070, 2110


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def patch_manifest(data: bytes, testing: bool = False) -> bytes:
    if testing:
        # Reconstructed offline 2.0.7 fixture has the same assets but a QA manifest.
        old = '2.0.7-qa0001'
        assert old.encode('utf-16le') in data
    else:
        package = EXPECTED_PROD_PACKAGE.encode('utf-16le')
        assert data.count(package) >= 1, 'Refusing APK with unexpected package identity'
        old = OLD_VERSION
    ob, nb = old.encode('utf-16le'), NEW_VERSION.encode('utf-16le')
    assert len(ob) == len(nb), 'Binary manifest length mismatch'
    assert data.count(ob) == 1, 'Expected exactly one old versionName'
    old_num, new_num = struct.pack('<I', OLD_CODE), struct.pack('<I', NEW_CODE)
    assert data.count(old_num) == 1, 'Expected exactly one 2070 versionCode'
    data = data.replace(ob, nb, 1).replace(old_num, new_num, 1)
    assert data.count(nb) == 1 and data.count(new_num) == 1
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', required=True)
    parser.add_argument('--bundle', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--fixture', action='store_true', help='Local QA asset replay only; never release')
    args = parser.parse_args()
    base_path, out_path = Path(args.base), Path(args.out)
    actual_hash = sha256(base_path.read_bytes())
    if args.fixture:
        assert actual_hash == '38a48a3fef2c03857df0df3aacaa765cc7f7c30ebfda88da53aef24c46af854e'
    else:
        assert actual_hash == EXPECTED_PROD_BASE, f'Wrong public source release: {actual_hash}'

    with tarfile.open(args.bundle, 'r:xz') as bundle:
        entries = {m.name: m for m in bundle.getmembers()}
        assert all(m.isfile() and (m.name=='manifest.json' or m.name.startswith(('new/assets/','patches/assets/'))) for m in entries.values())
        metadata = json.loads(bundle.extractfile(entries['manifest.json']).read())
        expected = metadata['target_assets']
        old_hashes = metadata['baseline_assets']
        assert len(expected) == 11 and len(old_hashes) == 6
        with zipfile.ZipFile(base_path) as src:
            assert src.testzip() is None
            originals = {n: src.read(n) for n in src.namelist()}
            assert 'AndroidManifest.xml' in originals
            for n, digest in old_hashes.items():
                assert sha256(originals[n]) == digest, f'Production base asset mismatch: {n}'
            replacements = {}
            with tempfile.TemporaryDirectory() as temporary:
                directory = Path(temporary)
                for n in expected:
                    if n in originals:
                        p = directory / n
                        p.parent.mkdir(parents=True, exist_ok=True)
                        p.write_bytes(originals[n])
                        patch_entry = entries['patches/' + n + '.patch']
                        patch_file = directory / (n.replace('/','_') + '.patch')
                        patch_file.write_bytes(bundle.extractfile(patch_entry).read())
                        subprocess.run(['patch', '--batch','--fuzz=0','-p1','--directory',str(directory),'--input',str(patch_file)],
                                       check=True, capture_output=True, text=True)
                        new = p.read_bytes()
                    else:
                        new = bundle.extractfile(entries['new/' + n]).read()
                    assert sha256(new) == expected[n], f'QA asset failed byte-identical check: {n}'
                    replacements[n] = new
            replacements['AndroidManifest.xml'] = patch_manifest(originals['AndroidManifest.xml'], testing=args.fixture)

            out_path.parent.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(out_path,'w') as dst:
                for info in src.infolist():
                    name = info.filename
                    if name.startswith('META-INF/') and (name=='META-INF/MANIFEST.MF' or name.endswith(('.SF','.RSA','.DSA','.EC'))):
                        continue
                    item = zipfile.ZipInfo(name, info.date_time)
                    item.compress_type, item.external_attr = info.compress_type, info.external_attr
                    item.internal_attr, item.create_system = info.internal_attr, info.create_system
                    item.comment = info.comment
                    dst.writestr(item, replacements.pop(name) if name in replacements else originals[name], compress_type=item.compress_type,compresslevel=6)
                for n, data in sorted(replacements.items()):
                    assert n.startswith('assets/'), 'Only new app assets are allowed'
                    dst.writestr(n,data,compress_type=zipfile.ZIP_DEFLATED,compresslevel=6)

            with zipfile.ZipFile(out_path) as dst:
                assert dst.testzip() is None
                for n in originals:
                    if n in expected or n=='AndroidManifest.xml' or (n.startswith('META-INF/') and (n=='META-INF/MANIFEST.MF' or n.endswith(('.SF','.RSA','.DSA','.EC')))):
                        continue
                    assert dst.read(n)==originals[n], f'Unexpected difference: {n}'
                assert len([n for n in dst.namelist() if n.endswith('.dex')])==5
                assert len([n for n in dst.namelist() if n.endswith('.so')])==10
                assert b'PandaCableGuide209' in dst.read('assets/panda_cable_guide_v209.js')
                assert b'PandaSafeSetup208' in dst.read('assets/panda_safe_setup_v208.js')
                assert b'buildRail();' not in dst.read('assets/panda_remote_nav_v207.js')
                assert dst.read('AndroidManifest.xml') != originals['AndroidManifest.xml']
            print(f'PASS: all {len(expected)} tested 2.0.11 assets match exact QA hashes; 5 DEX and 10 native libraries preserved')
            print('Unsigned APK SHA-256', sha256(out_path.read_bytes()))
            print('PACKAGE', EXPECTED_PROD_PACKAGE if not args.fixture else 'QA fixture')

if __name__ == '__main__':
    main()
