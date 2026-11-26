# SyncTube Website Load Test

This is a clean, independent Android project used to isolate the SyncTube WebView launch path.

- It uses the Android platform WebView directly.
- It loads only https://synctube.pntr.dev/.
- JavaScript and optional WebView features remain at their platform defaults for this first remote-page test.
- It does not use Android Browser Helper, Trusted Web Activity, Custom Tabs, Firebase, or the previous splash activity.
- Its application ID is com.heroazure.synctube.websitetest, so it can be installed alongside the earlier diagnostic APKs.
- The workflow uploads a test APK artifact and does not publish anything to the live website.

This is a diagnostic build, not the final SyncTube app.
