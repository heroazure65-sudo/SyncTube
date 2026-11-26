# SyncTube Chrome-session test

A separate diagnostic Android package that launches SyncTube as a Trusted Web Activity (TWA), using Chrome rather than an embedded WebView.

- Package: `com.heroazure.synctube.twastest`
- Website: `https://synctube.pntr.dev/`
- Firebase project: unchanged; the website continues to use the intentionally selected `schoolfriends-dev` project.

A WebView has its own browser storage and does not share Chrome's signed-in website session. A TWA uses Chrome's browser profile for the verified origin, so it can reuse the SyncTube Firebase session already stored by Chrome. Google also requires OAuth to use a supported browser or native sign-in flow rather than an embedded WebView.

The Firebase JS SDK's normal browser-local persistence is retained. No Firebase database, membership record, account, or security rule is modified.

The workflow builds the APK, computes its signing fingerprint, and adds a Digital Asset Links entry for this test package to the live site's existing `.well-known/assetlinks.json`. Existing package entries are preserved.
