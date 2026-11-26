# SyncTube TWA website association

Download `assetlinks.json` from the same successful GitHub Actions build as the preview APK and publish it at:

`.well-known/assetlinks.json`

The public URL must be:

https://synctube.pntr.dev/.well-known/assetlinks.json

Do not use a placeholder certificate fingerprint. It must match the APK being installed.
