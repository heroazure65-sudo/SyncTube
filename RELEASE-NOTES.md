# SyncTube Mobile Refresh — Release Notes

## Release contents

- YouTube-inspired mobile home navigation and a JioHoster-inspired watch-room/player panel.
- Room code restoration is awaited during login, rather than running in the background alongside Create/Join actions.
- New room codes are 8 characters (existing 6-character codes remain supported).
- Presence is stored per browser tab/session. Room restoration uses per-tab session storage, so one tab does not overwrite another tab's saved room. Leaving one tab preserves the shared participant record while another tab for the same UID is still online; the final tab to leave removes that participant record.
- Explicit Leave Room clears the saved room for that tab and removes its presence session. It removes the shared participant record only when no other online tab session for that UID remains.
- Failed room joins clean up their pending participant/presence records without tearing down an already-active room when the attempted code is invalid.
- Chat drafts are kept when sending fails; the client applies a short send cooldown.
- Player/account sheets support Escape, focus return, keyboard focus containment, and body-scroll locking.
- Service worker cache version is incremented to v4 so the refreshed app shell is installed.

## Deploy in this order

1. Open the [Firebase Realtime Database Rules page](https://console.firebase.google.com/project/schoolfriends-dev/database/schoolfriends-dev-default-rtdb/rules).
2. Replace the current rules with the full contents of `database.rules.json` from this package, then click **Publish**. This is required for self-removal from a room and the new per-tab presence path.
3. Open the [SyncTube GitHub repository](https://github.com/heroazure65-sudo/SyncTube). Upload/replace the contents of the `SyncTube-main` folder, preserving the root-level file layout (do not upload the containing folder as a nested directory).
4. Wait for the website deployment to finish, then open [SyncTube](https://synctube.pntr.dev/) and sign out/in or reload once so the new service worker can activate.
5. Test with two accounts/devices: create a room, join from the second account, refresh both, then open a second tab under one account, leave from one tab, and confirm the other tab remains connected. Finally leave from the last tab and confirm that participant disappears.

## Security boundaries

- Firebase Authentication plus the active `/members/{uid}` allowlist gates the app.
- Realtime Database rules enforce room participation, owner-only shared playback, immutable message creation, and bounded/typed record shapes. A user can delete their own participant record to leave.
- Browser-side URL checks, text-only rendering, bounded display names, and a chat cooldown are additional defensive UX measures. Client-side cooldowns can be bypassed and are not a security boundary.
- This static app does not include trusted server-side rate limiting, room-code attempt throttling, or App Check configuration. For stronger abuse protection, enable Firebase App Check for Realtime Database and add a trusted backend rate limiter. Do not assume a client-only app can enforce those protections.

## Checks performed on this package

- JavaScript syntax check with Node.
- JSON syntax check for Realtime Database rules and the web manifest.
- HTML parser check for duplicate IDs.
- Static check that ID selectors used by the app exist in `index.html`.
- CSS parser check.
- ZIP integrity check after packaging.

These are static checks. A live Firebase Emulator test and a physical Android/browser test have not been run in this environment.
