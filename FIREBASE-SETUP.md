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
rooms/{roomCode}/presence/{uid}/{sessionId}
```

Publish the complete `database.rules.json` in Realtime Database → Rules. Do not use test mode or public read/write rules.

### How room invitations work

A user must first be approved globally under `/members/{uid}`. An approved user can then join a room using its 8-character invitation code (older 6-character codes remain valid). The code is the room invitation; this version does not have a separate host approval queue for each room. Keep room codes private. New codes have 8 characters to make guessing substantially harder.

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


## Updating rules for the mobile room-lifecycle release

Before publishing the website files, publish the included `database.rules.json` to the existing Realtime Database. Open the [Realtime Database Rules page](https://console.firebase.google.com/project/schoolfriends-dev/database/schoolfriends-dev-default-rtdb/rules), replace the rules with the complete contents of this file, and click **Publish**. The updated rules allow an authenticated user to remove their own participant record when they explicitly leave, reject unexpected fields and validate required playback/chat/presence fields, and support per-tab presence sessions and self-removal only after the final active tab for that UID leaves. Room playback/chat/presence reads still require room participation. A small room metadata record remains readable to active members so they can validate a code before joining. Do not replace the Firebase project or database URL.

New rooms use 8-character invite codes. Existing 6-character room codes remain accepted so active rooms are not invalidated by the update. After the rules are published, upload the contents of the `SyncTube-main` folder to the existing website/GitHub repository.

Security boundary note: the short client-side chat cooldown is only a usability/abuse deterrent. Realtime Database rules validate access and payload shape, but they cannot enforce a trustworthy per-user rate limit. Strong anti-spam rate limiting requires a trusted backend (for example, a Cloud Function). Firebase App Check is also a separate project-level setup and is not enabled automatically by this static package.
