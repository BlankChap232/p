# Panda Tv Elite — Public Release and Real In-Place Updates

## Status (14 November 2026)

- Public version: **2.0.3**, signed QA APK promoted **byte-for-byte** to production.
- Latest release tag: `v2.0.3-elite-standalone-search-login-public.1`
- Public file: `PandaTV.apk`
- Public SHA-256: `9ba5767b571fe83789521521c349805c0a62ced57fbedd61a4c30ffc26de4c11`
- Android package: `com.pandatv.elitev301.elite203`
- Internal Android version code: `1889`; the inherited Android version name is `1.8.9-epgfix` (despite the user-facing 2.0.3 label).
- Signing certificate SHA-256: `6e94a795feb1c4b8d4eaf5029bd261c2cc8d32a92993287db63db721a7d1f8f5`
- The app already contains **PandaUpdateManager**, **PandaUpdateJobService**, the native **Update Center** and `panda_update_config_v185.json` targeting `BlankChap232/p`.
- The official manifest is `docs/version.json`. It is automatically published via GitHub Pages.
- **The 2.0.3 test signing key was generated on a temporary GitHub Actions runner and discarded**. It is not possible to recover the private signing key from the signed APK. Therefore **no future APK can be guaranteed to install over this specific 2.0.3 build**.

## What automatic updates can and cannot do

The native updater can check the hosted release manifest on startup and periodically in the background, notify a viewer, securely download a new APK, verify its size and SHA-256, and invoke the Android installation prompt.

Android may require the viewer to grant permission for this installation source and approve installation. **Do not advertise unattended/silent installation.** Video playback is not modified by update checks. Automatic update checks and native installation have not been verified on an actual Android TV using version 2.0.3.

An in-place upgrade requires:
1. **Same Android application ID** in both APKs.
2. **Same signing identity** (or an eligible Android signing-key rotation plan).
3. Higher **Android versionCode** than the installed version.
4. A verified release manifest with the correct APK URL, size and SHA-256.
5. Android's installation approval and compatible device requirements.

This is separate from the IPTV provider's automatic channel/EPG sync.

## Permanent channel setup — one-time transition

For the next QA candidate, use a **new permanent ID**, for example `com.pandatv.elitev301.elite204`, and set actual Android version to `2.0.4-stable`, versionCode `2040`.

This first stable build is a **one-time separate installation** and will not carry over credentials from prior 2.0.3 because the Android package name changes. After testing, retain this permanent ID for ALL future versions, use the same signing key on every build, and increase versionCode monotonically. Subsequent stable builds can update in place through the built-in updater (subject to real-device validation).

### Never put the signing key in this public repository

Generate a 3072-bit RSA Android signing keystore locally on a trusted computer using the JDK keytool. Keep at least two encrypted/offline backups, and add the keystore (base64-encoded) and its passwords as encrypted GitHub Actions repository secrets; see [GitHub's Actions secrets documentation](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions).

Suggested secret names:
- `PANDA_PROD_KEYSTORE_B64` — base64 of the keystore file (single line)
- `PANDA_PROD_STORE_PASSWORD` — the private keystore password
- `PANDA_PROD_KEY_ALIAS` — the private signing key alias
- `PANDA_PROD_KEY_PASSWORD` — the private key password

**Never paste any signing passwords or base64 keystore into chat, git commits, release notes, or support tickets.**

When these secrets exist, manually run `Build Panda Tv Elite permanent-signing QA` in GitHub Actions. It generates a private-signing test APK without changing public latest. Verify it on an actual phone and Android TV; then publish that **exact** tested APK as the new public stable foundation. Always keep your earlier working app installed until the new version works.

All future QA/release workflows must refuse to publish an APK with a different signing certificate than the first stable release.

## Owner-facing release policy

- Public latest is a verified and owner-approved signed APK, not an untested rebuilt player.
- No subscription/owner-console/Supabase permission is required for the standalone player.
- Do not rename or overwrite native player DEX, Media3/FFmpeg decoder libraries, EPG Genie, or native surf-title behavior as part of update-channel maintenance.
- An APK is only an *in-place update* when Android verifies its package ID, signing identity and version. A separately named or separately signed APK is a separate installation, not an upgrade.

For a fresh install, the official public download is [https://blankchap232.github.io/p/](https://blankchap232.github.io/p/).
