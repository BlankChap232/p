# PandaTV — official installer and update channel

This repository holds the **public download website**, update metadata, and APK release records. It does **not** expose the private app source, streaming credentials, provider playlists, or signing keys.

**Official installation webpage (after GitHub Pages is enabled):** https://blankchap232.github.io/p/

**Current distribution status: Panda Tv Elite approved public APK is live.** The latest release contains the verified `PandaTV.apk` installer with the owner-approved compact guide, preserved working v1.8.9 playback engine, and Android launcher label `Panda Tv Elite`. It installs separately from older package identities.

- Website: [docs/index.html](docs/index.html)
- TV/phone setup and release gate: [docs/RELEASE-CHECKLIST.md](docs/RELEASE-CHECKLIST.md)
- Publish web page workflow: [Publish PandaTV installation page](.github/workflows/pages.yml)
- Inspect draft release APK: [Validate PandaTV release APK](.github/workflows/validate-apk.yml)
- Update metadata: [docs/version.json](docs/version.json)
- Approved downloads: [Latest GitHub Release](https://github.com/BlankChap232/p/releases/latest)

## One-time activation

In this repository, visit **Settings > Pages**, select **GitHub Actions** as the source, and run **Actions > Publish PandaTV installation page > Run workflow**. Confirm the public page resolves before distributing its address.

## Publishing a verified APK

1. Build and production-sign from trusted Android source using the correct application ID and update signing key.
2. Test installing and using it on real Google TV, Android TV, phone and tablet devices.
3. Create a **draft** release and attach the exact file `PandaTV.apk`.
4. Run **Actions > Validate PandaTV release APK** using the draft tag. Review certificate, package, ZIP alignment and SHA-256.
5. Once all checks and real-device tests pass, **publish** the release. The installer webpage will then enable its APK download button.

Android always requests approval for side-loaded installs. No site or updater can legitimately bypass Google TV's security prompts. If Google Play Protect flags an APK as harmful, investigate the warning rather than bypassing it.

**Licensing:** Prior work included FFmpeg decoder components. Review source and binary redistribution obligations (including GPLv3 where applicable) before publishing.
