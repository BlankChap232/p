# PandaTV — public distribution checklist

The official installation page is https://blankchap232.github.io/p/ (requires GitHub Pages to be enabled in repository settings).
The installation page does **not** enable downloads while no official GitHub release exists.

## One-time GitHub Pages setup

On GitHub, open Settings > Pages and choose **GitHub Actions** as the Build and deployment source.
Then open Actions > Publish PandaTV installation page > Run workflow.
The URL should be opened on a phone or TV browser to confirm it is actually live.

## Production release gate (must pass before publishing)

1. Obtain a finished, approved, production-signed **PandaTV.apk** from the current Android source. Never publish the experimental separately signed PandaFix APK as an official update.
2. Verify the application ID is `com.pandatv.elitev301.media3qa` or deliberately migrate the package ID with a documented plan. Verify the release signing certificate matches the signing certificate of the version it is meant to update.
3. Test installation and launch on an actual Google TV, Android TV, phone, and tablet, plus Media3 playback, immersive navigation, remote focus, transparent flex-arm buffering, provider login, return-to-guide behavior, and auto-update.
4. On GitHub Releases, create a **draft release** and upload the file with the exact filename `PandaTV.apk`. Use a version tag (for example `v1.9.0`).
5. Run Actions > **Validate PandaTV release APK** with the draft release tag. Check APK signature, APK identity, 16-KB native-library alignment, and SHA-256 output. Resolve every error.
6. Manually **Publish release** only when device tests and automated validation pass. The installer page then displays the GitHub release asset.
7. If desired, obtain a short code for the **published page URL** from Downloader by AFTVnews' provider workflow. Never invent a numeric code.

## What the page does

* Shows release availability based on a real GitHub release and asset named `PandaTV.apk`.
* Provides TV/phone installation instructions and .bin troubleshooting.
* Keeps unavailable downloads disabled.
* Does not collect streaming credentials.
* Does **not** silently install Android apps or bypass Android security prompts.

## If download returns .bin

Ensure the file completely downloaded. Rename only if it is a complete real APK saved with the wrong extension, otherwise retry using Downloader. A package installation error is different from a download naming error. Never bypass a genuine Play Protect harmful-app warning.

## Current status

No official production APK release has been published yet. The earlier PandaFix binary was experimental, signed separately and not tested on physical hardware.
