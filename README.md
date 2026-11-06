# Panda TV — official update channel

This public repository distributes Panda TV update metadata and verified Android APK releases. Panda TV source code, account credentials, playlists, and signing keys are not published here.

**Status:** No public APK release has been published yet.

- Update manifest: [docs/version.json](docs/version.json)
- Release downloads (once published): [Latest Release](https://github.com/BlankChap232/p/releases/latest)
- Optional download page: [docs/index.html](docs/index.html) (GitHub Pages may need enabling in Settings → Pages, from main /docs)

To publish: create a production-signed and QA-tested APK with the same package ID and permanent signing key; upload it to GitHub Releases; verify its publicly accessible asset URL and SHA-256 checksum; only then set docs/version.json to published=true using the publisher tool. Do not place raw APKs or secrets directly in Git history.

The updater cannot silently install sideloaded APKs; Android installation approval is required. Hosting availability is subject to GitHub's free-tier rules and usage policies.

The added FFmpeg decoder in the current Panda TV source has GPLv3 compliance considerations; resolve redistribution obligations before distributing the APK publicly.
