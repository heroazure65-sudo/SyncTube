# Firebase setup checklist for this SyncTube package

This package is preconfigured for the Firebase project `synctube-8888d`.

## A. Enable Google login

1. Open https://console.firebase.google.com/ and select `synctube-8888d`.
2. Build → Authentication → Get started.
3. Sign-in method → Google → Enable.
4. Select a support email and Save.
5. Authentication → Settings → Authorized domains → add your GitHub Pages hostname, e.g. `YOUR_GITHUB_USERNAME.github.io` (hostname only, no scheme/path).

## B. Publish database security rules

1. Build → Realtime Database → Rules.
2. Open `database.rules.json` from this package.
3. Replace the rules editor contents with the entire file contents.
4. Press Publish.
5. Do not use test mode and do not set `.read` or `.write` to `true` globally.

Database URL configured in `firebase-config.js`:

`https://synctube-8888d-default-rtdb.asia-southeast1.firebasedatabase.app`

## C. Bootstrap the first owner (one time)

1. Deploy the site and open it in Chrome.
2. Sign in with the Google account that should own SyncTube.
3. The app will show a pending-access screen and a Firebase UID. Copy that UID.
4. Firebase Console → Build → Authentication → Users. Confirm the same account and copy its UID if needed.
5. Realtime Database → Data. Add a child at this exact path, replacing `OWNER_UID` with the real UID:

`members/OWNER_UID`

Set its JSON value to:

```json
{
  "active": true,
  "role": "owner",
  "displayName": "SyncTube Owner"
}
```

6. Sign out of SyncTube and sign in again. The owner panel should appear.

The owner can then approve each friend's UID using the in-app owner panel. Google sign-in alone does not grant room access.

## D. Important security notes

- The Firebase browser config is public by design; database rules and Authentication enforce access.
- Never upload Firebase Admin SDK service-account JSON, private keys, or database secrets.
- Do not add a wildcard/public database rule.
- The first owner record must be created manually in the Firebase Console. The client app deliberately cannot self-assign the owner role.
- This package uses Google sign-in and the YouTube IFrame Player API. It does not require a YouTube Data API key.
