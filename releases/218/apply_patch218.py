#!/usr/bin/env python3
"""Panda TV Elite 2.0.18 Home remote focus hotfix against exact public 2.0.17.
QA mode uses versionCode 2171 and production mode 2180. Same app identity.
This script never signs an APK or changes any native DEX / Media3 library.
"""
import argparse
import hashlib
from pathlib import Path
import struct
import zipfile

BASE_SHA = '3a738e68bded1a0ce3b4af0c2b4231b903c9ffc5a78ed0ab0e23f9b43a425aff'
BASE_HTML_SHA = 'dec2b2444812d727057a76296f414b8182b56137d9dfdab50c8fd36caa51465e'
BASE_NAV_SHA = 'd615adcefc4f24831b82791286bdc59ca4e790853a9b66df06be6e8a99bc6d87'
APP_ID = 'com.pandatv.elitev301.elite204'
ADDED = 'assets/panda_home_focus_v218.js'
HTML = 'assets/pandatv.html'
NAV = 'assets/pandatv_v186_nav_recovery.js'
SIG = ('META-INF/MANIFEST.MF',)
SOURCE = Path(__file__).resolve().parents[2] / 'android/home-focus218/panda_home_focus_v218.js'
ANCHOR = 'function keydown(e){\n // 2.0.7 single navigation arbiter.'
INJECT = '''function keydown(e){
 // 2.0.18: Home D-pad must run BEFORE 2.0.7's generic page-scroller.
 // Its fallback scroll kept the hero focused, making quick sections unreachable.
 if(window.PandaHomeFocus218?.handleKey?.(e)){
  e.preventDefault();e.stopImmediatePropagation();return;
 }
 // 2.0.7 single navigation arbiter.'''

def digest(data):
    return hashlib.sha256(data).hexdigest()

def signature(name):
    return name in SIG or (name.startswith('META-INF/') and name.endswith(('.SF','.RSA','.DSA','.EC')))

def patch_manifest(raw, mode):
    old_code = struct.pack('<I', 2170)
    new_code = struct.pack('<I', 2171 if mode == 'qa' else 2180)
    old_name = '2.0.17-final'.encode('utf-16le')
    new_name = ('2.0.17-qa001' if mode == 'qa' else '2.0.18-final').encode('utf-16le')
    assert len(old_name) == len(new_name)
    assert raw.count(old_code) == 1, 'Unexpected or ambiguous installed versionCode'
    assert raw.count(old_name) == 1, 'Unexpected installed versionName'
    assert raw.count(APP_ID.encode('utf-16le')) >= 1, 'Official Android package identity not found'
    changed = raw.replace(old_code,new_code,1).replace(old_name,new_name,1)
    assert changed.count(APP_ID.encode('utf-16le')) == raw.count(APP_ID.encode('utf-16le'))
    return changed

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--base',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--mode',choices=('qa','production'),default='qa')
    args=parser.parse_args()
    assert digest(args.base.read_bytes()) == BASE_SHA, 'Refusing unverified base APK'
    assert SOURCE.is_file(), 'Home fix source missing'
    with zipfile.ZipFile(args.base) as src:
        assert src.testzip() is None
        names=set(src.namelist())
        assert ADDED not in names, 'Fix already present: refuse stacking'
        raw_html=src.read(HTML)
        raw_nav=src.read(NAV)
        assert digest(raw_html)==BASE_HTML_SHA, 'Home layout differs from reviewed official 2.0.17'
        assert digest(raw_nav)==BASE_NAV_SHA, 'Navigation handler differs from reviewed official 2.0.17'
        html=raw_html.decode('utf-8')
        marker='<script src="panda_nav_cache_v194.js"></script>'
        assert html.count(marker)==1, 'Cannot safely insert after working cache repair'
        assert html.count('</body></html>')==1
        html=html.replace(marker,marker+'\n<!-- Panda TV 2.0.18: Home D-pad focus hotfix -->\n<script src="panda_home_focus_v218.js"></script>',1)
        nav=raw_nav.decode('utf-8')
        assert nav.count(ANCHOR)==1,'Cannot safely patch Home arbiter'
        nav=nav.replace(ANCHOR,INJECT,1)
        modified={HTML:html.encode('utf-8'),NAV:nav.encode('utf-8'),
                  'AndroidManifest.xml':patch_manifest(src.read('AndroidManifest.xml'),args.mode)}
        extra={ADDED:SOURCE.read_bytes()}
        args.out.parent.mkdir(parents=True,exist_ok=True)
        with zipfile.ZipFile(args.out,'w') as dest:
            for original in src.infolist():
                name=original.filename
                if signature(name): continue
                info=zipfile.ZipInfo(name,original.date_time)
                info.compress_type=original.compress_type
                info.external_attr=original.external_attr
                info.internal_attr=original.internal_attr
                info.create_system=original.create_system
                info.comment=original.comment
                data=modified.get(name)
                if data is None: data=src.read(name)
                dest.writestr(info,data,compress_type=info.compress_type,compresslevel=6)
            dest.writestr(ADDED,extra[ADDED],compress_type=zipfile.ZIP_DEFLATED,compresslevel=6)
    with zipfile.ZipFile(args.base) as a,zipfile.ZipFile(args.out) as b:
        assert b.testzip() is None
        diffs={n for n in a.namelist() if n in b.namelist() and a.read(n)!=b.read(n)}
        assert diffs == {HTML,NAV,'AndroidManifest.xml'}, diffs
        for n in a.namelist():
            if n.endswith(('.dex','.so')):
                assert a.read(n)==b.read(n),'Native player modified: '+n
        assert b.read(ADDED)==extra[ADDED]
        assert b'panda_nav_cache_v194.js' in b.read(HTML)
        assert b'panda_compact_guide_v216.js' in b.read(HTML)
        assert b'PandaFamily215' in b.read('assets/panda_family_catalog_v215.js')
        assert b'PandaCableGuide209' in b.read('assets/panda_cable_guide_v209.js')
        assert b'PandaUpdateManager' in b.read('classes4.dex')
    print('PASS: Home-only navigation patch; cache, guide, movies, series, Media3 unchanged')
    print('OUTPUT_SHA256',digest(args.out.read_bytes()))
    print('OUTPUT_BYTES',args.out.stat().st_size)
    print('MODE',args.mode)

if __name__=='__main__':
    main()
