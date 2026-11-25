# Firebase setup for SyncTube

This package is configured for the **SyncTube Web App** registered inside the existing Firebase project `schoolfriends-dev`.

## Firebase project

- Project ID: `schoolfriends-dev`
- Auth domain: `schoolfriends-dev.firebaseapp.com`
- Realtime Database: `https://schoolfriends-dev-default-rtdb.asia-southeast1.firebasedatabase.app`
- Web App ID: `1:807033346729:web:72531d797a9b8f3308e7b8`
- App nickname: SyncTube

The browser config is in `firebase-config.js`. These values are public client configuration, not Admin credentials.

## A. Authentication

1. Open [Firebase Authentication providers](https://console.firebase.google.com/project/schoolfriends-dev/authentication/providers).
2. Enable Google sign-in and choose a support email.
3. Open [Authorized domains](https://console.firebase.google.com/project/schoolfriends-dev/authentication/settings).
4. Confirm `synctube.pntr.dev` is listed.
5. Email/Password sign-in is also present in the UI. If you want to use it, enable Email/Password in the same provider screen; Google sign-in alone is sufficient for Google login.

## B. Realtime Database

The database is in `asia-southeast1`. The `database.rules.json` file matches the app's current data paths:

```text
members/{uid}
rooms/{roomCode}/meta
rooms/{roomCode}/participants/{uid}
rooms/{roomCode}/playback
rooms/{roomCode}/chat/{messageId}
rooms/{roomCode}/presence/{uid}
```

Publish the complete `database.rules.json` in Realtime Database → Rules. Do not use test mode or public read/write rules.

### How room invitations work

A user must first be approved globally under `/members/{uid}`. An approved user can then join a room using its six-character invitation code. The code is the room invitation; this version does not have a separate host approval queue for each room. Keep room codes private.

## C. Bootstrap the first owner

1. Deploy the website and open `https://synctube.pntr.dev/`.
2. Sign in with Google using the account that should own SyncTube.
3. The app displays the Firebase UID on its pending-access screen. Copy it.
4. Open [Realtime Database Data](https://console.firebase.google.com/project/schoolfriends-dev/database/schoolfriends-dev-default-rtdb/data).
5. Add this object at `/members/PASTE_OWNER_UID`, replacing the path with the real UID:

```json
{
  "active": true,
  "role": "owner",
  "displayName": "SyncTube Owner"
}
```

6. Sign out and sign in again. The owner panel should appear.

The Firebase Console is used for the first owner bootstrap because the client app must never be able to grant itself the owner role.

## D. Approve friends

1. Ask each friend to sign in once so Firebase creates their account.
2. Ask them to send you their Firebase UID privately.
3. In SyncTube's owner panel, add their UID.
4. They can then sign in and join a room using its invitation code.

## Security

- Never upload Firebase Admin service-account JSON, private keys, database secrets, or OAuth client secrets.
- The Firebase web config and API key are expected to be visible in the browser.
- Authentication and Realtime Database Security Rules protect user data.
- Keep the database rules restrictive. Do not publish `.read: true` or `.write: true`.
