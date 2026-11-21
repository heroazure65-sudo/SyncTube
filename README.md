# SyncTube — watch YouTube together

A lightweight, static website for GitHub Pages. Firebase Realtime Database syncs the shared video and playback state. No AI API, no token usage, and no custom server are required.

## What is included
- Create a room or join with a room code / invite URL (`#room=ROOM-CODE`).
- Host loads a YouTube URL; viewers receive the same video.
- Host play/pause/seek actions are broadcast to the room.
- Playback starts on a short future timestamp so connected clients can begin together.
- Responsive dark neon UI, CSS motion, and optional synthesized UI sound effects.
- Anonymous Firebase Authentication; only the room creator can modify its room record.

## 1. Create the free Firebase backend
1. Go to https://console.firebase.google.com/ and create a Firebase project.
2. Add a **Web app** in Project settings and copy its config into `firebase-config.js`.
3. In **Build → Authentication → Sign-in method**, enable **Anonymous**.
4. In **Build → Realtime Database**, create a database. Choose a nearby region.
5. Open the Realtime Database **Rules** tab and paste the contents of `database.rules.json`, then publish.
6. Copy the database URL into `databaseURL` in `firebase-config.js`. Use the exact database URL shown in the Firebase console; it may end in `firebasedatabase.app` or `firebaseio.com`.

The website deliberately does not include a Firebase secret. The web config's API key is expected to be visible in a browser; access is controlled by Authentication and Database Rules.

## 2. Publish free on GitHub Pages
1. Create a GitHub repository, for example `synctube`.
2. Upload all files and the `assets` folder from this project to the repository root.
3. Open **Settings → Pages**.
4. Under Build and deployment, select **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
5. Wait for the Pages URL to become available. Open it over HTTPS.

You can also test locally using a local static server (not by opening `index.html` as `file://`, because browser ES modules and Firebase need an HTTP origin).

## 3. Use it
1. Open the website and wait for the Firebase status to say Connected.
2. One person selects **Create room** and shares the room invite link.
3. Everyone else opens that link or enters the room code with **Join a room**.
4. The host pastes a normal YouTube video URL and chooses **Load video**.
5. Every viewer taps **Enable Playback** once, then the host presses Play.

## Important limitations
- YouTube playback is embedded using the official YouTube IFrame Player API. The app does not download, proxy, or restream YouTube video.
- Browsers can block autoplay until a viewer interacts with the page. Each viewer must tap **Enable Playback** first. Muted/autoplay policies, device performance, network latency, YouTube ads, age restrictions, and regional restrictions can cause small differences. This is synchronized playback, not frame-perfect broadcast.
- YouTube may disallow embedding for some videos. Those videos cannot play in the embedded player.
- The room database stores a room's current video and playback state. This starter version intentionally omits chat and presence counts to keep the backend small and rules simple. The chat box is a visual placeholder.
- Anonymous users can read room records. Room codes are identifiers, not passwords. Do not use this starter for private or sensitive sessions. For stronger privacy, add membership authorization and rate limits before public launch.
- Firebase's free Spark limits and policies can change. Check the current Firebase pricing page before a large public launch.

## Cost profile
GitHub Pages serves static files. Firebase Realtime Database only carries small room-state updates; video bytes come directly from YouTube. No AI model/API is used. A busy public service may exceed free Firebase quotas, so monitor usage in the Firebase console.
