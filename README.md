# SyncTube Pro — Firebase Configured Shared Room Edition

SyncTube is a lightweight, private YouTube watch-party website designed for GitHub Pages and Firebase. **There is only one playback mode: Watch Together.** Each room has one shared YouTube player state and one shared playlist/queue. The room host controls playback; approved members watch the same room stream, chat, and see who is online.

SyncTube does not host or re-stream video. Each participant's browser loads the video directly from YouTube through the official YouTube IFrame Player API. Firebase stores only room membership, presence, chat, and compact playback state. This build does **not** use YouTube Data API search and does not need a YouTube API key.

## Features

- **Shared YouTube playlist:** The host can paste one public or unlisted YouTube playlist URL. The official player loads the playlist and advances through its episodes.
- **Custom shared queue:** The host can paste up to 100 individual YouTube video URLs, one per line, to create one shared queue. Duplicate videos are removed.
- **Append videos from YouTube Share:** On supported Android browsers, install SyncTube as a PWA and use YouTube Share → SyncTube. The incoming video is appended to the room queue when the host account imports it. If the app opens without an active room, join/create the room and SyncTube will process the pending shared link. Non-host members cannot alter the shared queue.
- **Single shared playback:** There is no Personal Mode, local-only player, or separate personal playback state.
- **Host-only transport controls:** The host can play, pause, seek, and move to the previous/next episode. The embedded YouTube controls are hidden so viewers cannot independently control playback. Some browsers may require a viewer to tap **Start synced playback** once to satisfy autoplay restrictions.
- **Automatic synchronization:** Members follow the host's video/playlist index, playback state, and approximate playback position. Small timing differences from buffering and network latency are normal.
- **Private rooms:** Create a room and invite approved members using its six-character code.
- **Room chat and presence:** Members can send text messages and see who is online.
- **Owner member management:** The owner can approve Firebase Authentication UIDs.
- **PWA install/share target:** Installable on supported browsers, with Android share integration where Web Share Target is supported.
- **Responsive interface:** Desktop and mobile layouts.

## Honest limitations

- YouTube search, recommendations, and automatic import of Watch Later are not included. Find videos in YouTube and share/paste a video or playlist URL.
- YouTube Data API is not used, so there is no search quota to configure. Loading an embed playlist uses the official IFrame Player API, not YouTube Data API search.
- Direct Share-to-SyncTube depends on the browser and OS supporting installed PWA share targets. If SyncTube does not appear in the YouTube Share menu, use the top link field or the multi-link queue builder.
- Only the room host can load a new playlist, modify the queue, select episodes, play, pause, or seek. Other members watch and chat. A member who shares a video into SyncTube must ask the host to add it.
- Room state is not a frame-accurate broadcast. Devices may drift briefly due to buffering or network conditions; the app periodically corrects larger differences.
- Use public or unlisted YouTube playlists. Private playlists may not be playable to other room members. Individual videos can be unavailable for embedding due to the uploader's settings, age/region restrictions, or YouTube policy.
- YouTube can show ads and apply its own playback policies. SyncTube does not remove ads or bypass restrictions.
- Mobile browsers may block autoplay until each participant taps **Start synced playback** once.
- Free services have quotas and terms. Free does not mean unlimited, and actual capacity depends on Firebase usage and YouTube/browser conditions.

## Requirements

1. A Firebase project with **Google and/or Email/Password Authentication** and **Realtime Database** enabled.
2. A GitHub account and a public repository for GitHub Pages Free.

The browser loads Firebase JavaScript SDK 13.4.0 and the official YouTube IFrame Player API from their providers' CDNs. The Firebase config is already filled for project `synctube-8888d`. No YouTube Data API key, Firebase Admin key, Node build, application server, or paid hosting is required by this version.

## 1. Firebase project already configured in this package

This package is pre-filled with the Firebase Web App configuration supplied for the user's project `synctube-8888d` and its Realtime Database in `asia-southeast1`. You do not need to create another Firebase project or replace the values in `firebase-config.js`.

**Before the website can sign in or read/write data, finish these console steps:**

1. Open [Firebase Console](https://console.firebase.google.com/) and select project **synctube-8888d**.
2. Go to **Build → Authentication → Get started → Sign-in method**. Enable **Google**, choose a support email, and save. Email/Password is optional; the Google button is the intended easy-login route.
3. Go to **Authentication → Settings → Authorized domains**. Add your GitHub Pages host, for example `YOUR_GITHUB_USERNAME.github.io` (do not include `https://` or a path). Add `localhost` only for local development.
4. Open **Realtime Database → Rules**. Replace the editor contents with the complete contents of this package's `database.rules.json`, then press **Publish**. Keep the database in locked mode until these rules are published. Do not switch to test mode or make the database public.
5. Confirm the Realtime Database URL shown in the console is `https://synctube-8888d-default-rtdb.asia-southeast1.firebasedatabase.app`.

The package includes the actual browser configuration you supplied. The Firebase Web API key is not an Admin credential; it is expected to be visible in client-side code. Never publish a Firebase Admin service-account JSON, private key, database secret, or other server credential.

Google sign-in uses Firebase Authentication's Google provider and the popup flow. It does not require a separate Google Cloud OAuth client ID or a YouTube API key in this client-side setup. Enable the Google provider in Firebase, set a support email, and authorise your deployed domain. Some browsers or embedded in-app browsers may block pop-ups; open the website in Chrome if sign-in is blocked.

Do not use test-mode database rules. Do not publish a Firebase Admin service-account JSON, private key, database secret, or other server credential.

## 2. Create the first owner

The first owner is bootstrapped once through the Firebase Console; the browser app cannot grant its own owner role. This is intentional: a new Google account must not be able to promote itself to owner.

1. Open the deployed SyncTube website and choose **Continue with Google** (or **Create account** with email/password) using the account you want to own SyncTube.
2. The app displays the Google account's Firebase UID and says access is pending. Google login does not bypass the invite-only approval gate.
3. In Firebase Console → Authentication → Users, find that account and copy its UID.
4. In Realtime Database → Data, add this object at `/members/PASTE_OWNER_UID` (replace the path segment with the actual UID):

```json
{
  "active": true,
  "role": "owner",
  "displayName": "Room Owner"
}
```

5. Sign out from SyncTube and sign in again. The owner panel should now appear.

**Important:** Do not put the owner record under `/rooms`. It belongs at the root path `/members/OWNER_UID`.

The owner role applies to room creation. The creator of each room becomes that room's playback host.

## 3. Approve friends

1. Ask each friend to create an account on your deployed SyncTube page.
2. They will see a pending-access screen with their Firebase UID. Ask them to send that UID to you privately.
3. In the owner's **Manage the guest list** panel, paste the UID and choose **Approve**.
4. The friend can sign out and sign in again. They can now create a room or join using its invite code.

Only UIDs in `/members` with `active: true` can enter the app. Knowing a room code alone is not enough; the account must also be approved.

## 4. Create a room and load its shared playlist

1. Sign in with an approved account.
2. Choose **Create a room**. The room creator becomes its host. Share the six-character invite code with your approved friends.
3. Friends sign in and choose **Join a room** using that code.
4. In the host's SyncTube window, paste a YouTube playlist URL into the top field. It should contain `list=...`, for example `https://www.youtube.com/playlist?list=PLAYLIST_ID`, then press **Load**.
5. To create a queue from separate videos, expand **Build a custom queue from separate videos**, paste one video URL per line (up to 100), and choose **Create queue**.
6. The host uses the custom controls under the player to play/pause, seek, or move between episodes. Everyone in the room follows the same player state.

Non-host controls for loading content and changing episodes are disabled. The host can also share an individual video from YouTube to the installed SyncTube PWA; the shared video is appended to the room queue when the host imports it.

No YouTube search API is called. The official player accepts a playlist ID through its IFrame Player API. References:
- [YouTube embedded player parameters](https://developers.google.com/youtube/player_parameters)
- [YouTube IFrame Player API reference](https://developers.google.com/youtube/iframe_api_reference)

## 5. Install SyncTube and share from YouTube (Android)

1. Deploy SyncTube to GitHub Pages over HTTPS.
2. Open the deployed page in a browser that supports installed PWA share targets (Chrome on Android is a common supported route).
3. Use the **Install app** button when available, or open the browser menu and choose **Install app** / **Add to Home screen**.
4. Open YouTube, choose a video, tap **Share**, and select **SyncTube** from the Android share sheet.
5. If the host account shared the video and the app opens without a room selected, join the intended room; SyncTube will append the pending video to the shared queue. If a non-host member shares a video, SyncTube will not change the room queue—the member should send the link to the host, who can add it. Sharing a playlist URL from the host account loads that playlist into the room.

The Web Share Target API requires the PWA to be installed before it appears in the system share picker. The browser may put the shared URL in the `text` field rather than the dedicated `url` field; SyncTube checks both. References: [Chrome's Web Share Target guide](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target/) and [MDN share_target reference](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target).

## 6. Publish on GitHub Pages

1. Create a **public** GitHub repository, for example `synctube`.
2. Upload the **contents** of this folder into the repository root. Make sure `index.html` is at the root, not nested inside another folder.
3. Commit the changes to the `main` branch.
4. In GitHub → repository **Settings → Pages**, set **Deploy from a branch**, select `main` and `/(root)`, then save.
5. Open `https://YOUR_GITHUB_USERNAME.github.io/synctube/` after Pages deploys.
6. In Firebase Authentication → Settings → Authorized domains, add `YOUR_GITHUB_USERNAME.github.io`.

GitHub Pages Free normally requires a public repository. That means the HTML, CSS, JavaScript, and Firebase web configuration can be viewed by visitors. Firebase web config is designed to be public; Firebase Security Rules and Authentication must protect the database. Never put Admin credentials or service-account private keys in this repository.

## 7. Firebase data structure

```text
members/{uid}
  active: true
  role: "owner" | "member"

rooms/{roomCode}/meta
  ownerUid, name, createdAt

rooms/{roomCode}/participants/{uid}
  true

rooms/{roomCode}/playback
  videoId, videoTitle, channelTitle
  playlistId, queueIds, playlistIndex
  state, positionSec, updatedAt, updatedBy

rooms/{roomCode}/chat/{messageId}
  uid, name, text, createdAt

rooms/{roomCode}/presence/{uid}
  name, online, seenAt
```

There is one shared playback record per room. There is no personal playback object in local storage or Firebase. Video bytes stream directly from YouTube to each viewer; Firebase receives only small state/chat/presence data.

## 8. Free-tier expectations and group size

- Firebase Realtime Database quotas and simultaneous-connection limits can change. Check the current [Firebase pricing page](https://firebase.google.com/pricing) before inviting a large group.
- A 30-person room may fit within the commonly published Spark simultaneous-connection limit if the project has no other significant connected clients, but this is not a guarantee of unlimited free use. Each connected browser/device counts as a connection.
- Firebase traffic is room state, chat, presence, and listener updates. YouTube video traffic is delivered by YouTube and does not pass through Firebase.
- The project intentionally avoids YouTube search API calls. Playlist loading uses the IFrame Player API.

## 9. Security notes

- Database rules deny access by default and require Firebase Authentication plus an active `/members/{uid}` record.
- Room reads require participation in that room. Only the room owner can change shared playback.
- The owner can approve global members. This is a private friend-group access model, not a complete public SaaS abuse-prevention system.
- Firebase App Check can add an abuse-reduction layer, but it does not replace Authentication or database rules.
- Avoid putting email addresses or sensitive information in room data.

## 10. Local preview

From this folder, run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. Add `localhost` to Firebase Authentication's authorized domains for local testing. Replace the Firebase placeholders before attempting to sign in.

## 11. Files

- `index.html` — shared-room-only app structure and interface
- `styles.css` — responsive visual design and host-only controls
- `app.js` — Google and email/password authentication, YouTube URL parsing, shared playlist/queue, synchronization, chat, and presence
- `firebase-config.js` — public Firebase configuration placeholders; no YouTube API key
- `database.rules.json` — Realtime Database security rules
- `firebase.json` — optional Firebase CLI rules mapping
- `manifest.webmanifest` — PWA and Android share-target configuration
- `sw.js` — app-shell caching and PWA installation support
- `assets/` — SyncTube app icons and favicon
