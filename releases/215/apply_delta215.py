#!/usr/bin/env python3
"""Rebuild Panda Tv Elite 2.0.15 from pinned 2.0.11 signed APK.

Patches only reviewed presentation + safe setup assets and Android version
metadata. Never exports signing keys; production signing occurs only in Actions.
"""
import argparse
import hashlib
import io
import json
import pathlib
import re
import struct
import subprocess
import tarfile
import tempfile
import zipfile

BASE_PROD_SHA = '01a34139a612943f52a891216c3df4ca754f21ed266f71fd7b481a321f05004d'
BASE_QA_SHA = '28005d594ed87931e29b7973d8780ec0e246f840bfd7128a5496fbcc224a3ac3'
TARGET_QA_SHA = '060b3c5ef367f036bf80d109f3d35b0b26c76cd1c8ba5a91c16c524c245c522e'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def patch_manifest(raw, fixture=False):
    code_old, code_new = struct.pack('<I', 2110), struct.pack('<I', 2150)
    assert raw.count(code_old) == 1, 'VersionCode is ambiguous; refuse update'
    if fixture:
        old_pkg, new_pkg = 'com.pandatv.elitev301.elite211', 'com.pandatv.elitev301.elite215'
        old_name, new_name = '2.0.11-qa001', '2.0.15-qa001'
    else:
        old_pkg = new_pkg = 'com.pandatv.elitev301.elite204'
        old_name, new_name = '2.0.11-final', '2.0.15-final'
    old = old_pkg.encode('utf-16le')
    new = new_pkg.encode('utf-16le')
    assert len(old) == len(new) and raw.count(old) >= 1, 'Unexpected base Android package'
    if fixture:
        raw = raw.replace(old, new)
    old = old_name.encode('utf-16le')
    new = new_name.encode('utf-16le')
    assert len(old) == len(new) and raw.count(old) == 1, 'Unexpected base version name'
    raw = raw.replace(old, new, 1).replace(code_old, code_new, 1)
    assert new in raw and code_new in raw
    return raw


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', type=pathlib.Path, required=True)
    ap.add_argument('--bundle', type=pathlib.Path, required=True)
    ap.add_argument('--out', type=pathlib.Path, required=True)
    ap.add_argument('--mode', choices=['production', 'fixture'], default='production')
    args = ap.parse_args()
    fixture = args.mode == 'fixture'
    actual_sha = sha(args.base.read_bytes())
    assert actual_sha == (BASE_QA_SHA if fixture else BASE_PROD_SHA), 'Refusing unexpected release base: ' + actual_sha
    with tarfile.open(args.bundle, mode='r:xz') as tar:
        entries = {m.name: m for m in tar.getmembers()}
        assert all(m.isfile() and (m.name in ('diff.patch', 'checksums.json', 'tests/test_family215.cjs') or m.name.startswith('new/assets/')) for m in entries.values()), 'Unexpected bundle member'
        meta = json.loads(tar.extractfile(entries['checksums.json']).read())
        diff = tar.extractfile(entries['diff.patch']).read()
        changed, added = meta['changed'], meta['added']
        assert len(changed) == 10 and len(added) == 2
        assert set(changed).isdisjoint(added)
        assert all(n.startswith('assets/') and '..' not in n for n in changed + added)
        assert set(meta['base_asset_sha256']) == set(changed)
        assert set(meta['target_asset_sha256']) == set(changed + added)
        assert set(entries) == {'diff.patch', 'checksums.json', 'tests/test_family215.cjs'} | {'new/' + n for n in added}
        new_bytes = {n: tar.extractfile(entries['new/' + n]).read() for n in added}
        test_script = tar.extractfile(entries['tests/test_family215.cjs']).read()
    with zipfile.ZipFile(args.base) as z:
        assert z.testzip() is None
        originals = {inf.filename: z.read(inf.filename) for inf in z.infolist()}
        assert not any(n in originals for n in added), 'Added asset already exists'
        for name in changed:
            assert name in originals
            assert sha(originals[name]) == meta['base_asset_sha256'][name], 'Unexpected base asset: ' + name
        dex = [n for n in originals if n.endswith('.dex')]
        libs = [n for n in originals if n.endswith('.so')]
        assert len(dex) == 5 and len(libs) == 10
        manifest = patch_manifest(originals['AndroidManifest.xml'], fixture)
        with tempfile.TemporaryDirectory() as td:
            work = pathlib.Path(td)
            for n in changed:
                file = work / n
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_bytes(originals[n])
            diff_file = work / 'changes.patch'
            diff_file.write_bytes(diff)
            subprocess.run(['patch', '--batch', '--fuzz=0', '-p1', '-i', str(diff_file)],cwd=work,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            modified = {n: (work / n).read_bytes() for n in changed}
        modified.update(new_bytes)
        for n in changed + added:
            assert sha(modified[n]) == meta['target_asset_sha256'][n], 'Patched asset differs from user-tested 2.0.15: ' + n
        html = modified['assets/pandatv.html']
        assert b'panda_family_catalog_v215.js' in html and b'panda_family_catalog_v215.css' in html
        assert b'PandaFamily215' in modified['assets/panda_family_catalog_v215.js']
        assert b'PandaCableGuide209' in originals['assets/panda_cable_guide_v209.js']
        assert b'PandaUpdateManager' in originals['classes4.dex']
        args.out.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(args.out, 'w') as out:
            for inf in z.infolist():
                n = inf.filename
                if n == 'META-INF/MANIFEST.MF' or (n.startswith('META-INF/') and n.endswith(('.SF', '.RSA', '.DSA', '.EC'))):
                    continue
                zi = zipfile.ZipInfo(n,inf.date_time)
                zi.compress_type = inf.compress_type
                zi.external_attr = inf.external_attr
                zi.internal_attr = inf.internal_attr
                zi.create_system = inf.create_system
                zi.comment = inf.comment
                zi.extra = b''
                if n.endswith('.so') and zi.compress_type == zipfile.ZIP_STORED:
                    offset = out.fp.tell() + 30 + len(n.encode('utf-8'))
                    pad = (4096 - ((offset + 4) % 4096)) % 4096 + 4
                    zi.extra = struct.pack('<HH',0xfffe,pad - 4) + bytes(pad - 4)
                data = manifest if n == 'AndroidManifest.xml' else modified.get(n, originals[n])
                out.writestr(zi,data,compress_type=zi.compress_type,compresslevel=6)
            for n in added:
                zi = zipfile.ZipInfo(n)
                zi.compress_type = zipfile.ZIP_DEFLATED
                out.writestr(zi,modified[n],compress_type=zi.compress_type,compresslevel=6)
    with zipfile.ZipFile(args.out) as result:
        assert result.testzip() is None
        for n in changed + added:
            assert result.read(n) == modified[n]
        for n in originals:
            if n in changed or n == 'AndroidManifest.xml' or (n.startswith('META-INF/') and (n == 'META-INF/MANIFEST.MF' or n.endswith(('.SF','.RSA','.DSA','.EC')))):
                continue
            assert result.read(n) == originals[n], 'Unexpected modification to ' + n
        for n in dex + libs:
            assert result.read(n) == originals[n]
    with tempfile.TemporaryDirectory() as td:
        root=pathlib.Path(td)
        (root/'mod_assets').mkdir()
        (root/'panda_family_catalog_v215.js').write_bytes(modified['assets/panda_family_catalog_v215.js'])
        (root/'mod_assets/pandatv_v2943_native_catalog.js').write_bytes(modified['assets/pandatv_v2943_native_catalog.js'])
        (root/'test_family215.cjs').write_bytes(test_script)
        subprocess.run(['node', str(root/'test_family215.cjs')], check=True)
        for n in changed + added:
            if n.endswith('.js'):
                file=root/pathlib.Path(n).name
                file.write_bytes(modified[n])
                subprocess.run(['node','--check',str(file)],check=True)
    print('PASS: preserved public native player + update manager; 12 tested assets byte-identical to approved QA; versionCode 2150')
    print('UNSIGNED_SHA256=' + sha(args.out.read_bytes()))
    print('UNSIGNED_SIZE=' + str(args.out.stat().st_size))

if __name__ == '__main__':
    main()
