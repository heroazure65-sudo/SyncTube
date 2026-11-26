# SyncTube Android — Ghost App Preview

This project wraps the live SyncTube website in an Android Trusted Web Activity (TWA).

- App name: SyncTube
- Package ID: `com.heroazure.synctube`
- Website: https://synctube.pntr.dev/
- Native launch animation: dark background, purple/cyan orbit, particles and SyncTube wordmark.
- Website rendering: browser-backed TWA, not an embedded WebView.

## Full-screen requirement

After Digital Asset Links verification succeeds, Android can open the site without browser address or navigation controls. Until the matching signing fingerprint is published at `https://synctube.pntr.dev/.well-known/assetlinks.json`, the browser may show a Custom Tab instead.

## Build the preview APK

The workflow `.github/workflows/build-synctube-android-preview.yml` builds a debug APK and generates the matching `assetlinks.json`.

1. Open the repository Actions tab.
2. Select **Build SyncTube Android Preview APK**.
3. Run the workflow, or wait for its automatic run after project changes.
4. Download the `SyncTube-Android-Preview` artifact from a successful run.
5. Publish its `assetlinks.json` at `.well-known/assetlinks.json` on the website before expecting verified full-screen mode.

The workflow uses a temporary GitHub runner debug key. A new run can generate a different fingerprint, so replace the website's assetlinks file with the one from the same APK build.

## Scope

This is a preview wrapper only. It does not modify the SyncTube website or Firebase configuration. Production signing, native notifications, offline enhancements and a native Google sign-in implementation are not included.


Build note: Android 12 splash resources are configured without AndroidX splash attributes so the project can link against the platform SDK directly.
