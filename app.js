import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updateProfile, signOut,
  GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";
import {
  getDatabase, ref, get, set, update, push, onValue, query,
  limitToLast, onDisconnect, remove, serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const requiredFirebaseValues = [firebaseConfig.apiKey, firebaseConfig.authDomain, firebaseConfig.databaseURL, firebaseConfig.projectId, firebaseConfig.appId];
const configReady = requiredFirebaseValues.every((value) => typeof value === "string" && value && !value.includes("YOUR_"));
let app = null, auth = null, db = null, currentUser = null, memberProfile = null;
let isOwner = false, activeRoomCode = null, roomMeta = null, sharedPlayback = null;
let pendingIncomingShare = null, currentVideoId = "", currentVideoMeta = null, currentPlaylistId = "", currentQueueIds = [], currentPlaylistIndex = 0, ytPlayer = null, playerReady = false;
let roomUnsubs = [], ownerMembersUnsub = null, serverTimeOffset = 0, lastPublishAt = 0;
let activePresenceRef = null, activePresenceRoomCode = null, roomActionBusy = false, lastChatSentAt = 0;
let settingsReturnFocus = null, accountReturnFocus = null;
let toastTimer = null, authMode = "signin";

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 2600);
}

const THEME_SETTINGS_KEY = "synctube:v1:settings";
const THEME_MODES = ["system", "light", "dark"];
let themePreference = "system";
try {
  const savedSettings = JSON.parse(localStorage.getItem(THEME_SETTINGS_KEY) || "{}");
  if (THEME_MODES.includes(savedSettings?.theme)) themePreference = savedSettings.theme;
} catch { /* Storage can be disabled; System remains the default. */ }

function applyThemePreference(mode, persist = true) {
  themePreference = THEME_MODES.includes(mode) ? mode : "system";
  if (themePreference === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", themePreference);

  const button = $("#themeToggleBtn");
  if (button) {
    const index = THEME_MODES.indexOf(themePreference);
    const nextMode = THEME_MODES[(index + 1) % THEME_MODES.length];
    const currentLabel = themePreference[0].toUpperCase() + themePreference.slice(1);
    const nextLabel = nextMode[0].toUpperCase() + nextMode.slice(1);
    const description = `Color theme: ${currentLabel}. Activate to switch to ${nextLabel}.`;
    button.setAttribute("aria-label", description);
    button.title = description;
    const visibleLabel = button.querySelector(".theme-mode-label");
    if (visibleLabel) visibleLabel.textContent = currentLabel;
  }

  const darkPreference = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  const isDark = themePreference === "dark" || (themePreference === "system" && darkPreference !== false);
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = isDark ? "#0b0b12" : "#f5f3f8";

  if (persist) {
    try {
      const current = JSON.parse(localStorage.getItem(THEME_SETTINGS_KEY) || "{}");
      const settings = current && typeof current === "object" && !Array.isArray(current) ? current : {};
      settings.theme = themePreference;
      localStorage.setItem(THEME_SETTINGS_KEY, JSON.stringify(settings));
    } catch { /* The theme still changes for this page view. */ }
  }
}
applyThemePreference(themePreference, false);
$("#themeToggleBtn").addEventListener("click", () => {
  const nextMode = THEME_MODES[(THEME_MODES.indexOf(themePreference) + 1) % THEME_MODES.length];
  applyThemePreference(nextMode);
  toast(`Theme: ${nextMode[0].toUpperCase() + nextMode.slice(1)}`);
});
const systemThemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
systemThemeQuery?.addEventListener?.("change", () => {
  if (themePreference === "system") applyThemePreference("system", false);
});

function setMessage(selector, message, type = "") {
  const node = $(selector);
  if (!node) return;
  node.textContent = message;
  node.className = `form-message${type ? ` ${type}` : ""}`;
}
function initials(value) {
  const name = (value || "S").trim();
  return name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "S";
}
function escapeText(value) { return String(value ?? ""); }
function boundedText(value, maxLength, fallback) { return String(value ?? "").trim().slice(0, maxLength) || fallback; }
function showGate(which) {
  $("#authGate").classList.toggle("hidden", which !== "auth");
  $("#pendingGate").classList.toggle("hidden", which !== "pending");
  $("#appShell").classList.toggle("hidden", which !== "app");
}
function setBusy(button, busy, label = "Working…") {
  if (!button) return;
  if (busy) { button.dataset.originalHtml = button.innerHTML; button.textContent = label; button.disabled = true; }
  else { if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml; button.disabled = false; }
}
function formatTime(timestamp) {
  if (!timestamp) return "now";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function userName() { return String(memberProfile?.displayName || currentUser?.displayName || currentUser?.email?.split("@")[0] || "Member").trim().slice(0, 32) || "Member"; }
function activeMember() { return Boolean(currentUser && memberProfile?.active === true); }
function roomIsHost() { return Boolean(activeRoomCode && roomMeta?.ownerUid === currentUser?.uid); }
function safeVideoId(value) { return /^[A-Za-z0-9_-]{11}$/.test(value || "") ? value : ""; }
function safePlaylistId(value) { return /^[A-Za-z0-9_-]{10,80}$/.test(value || "") ? value : ""; }
function parseYouTubeLink(input) {
  const raw = String(input || "").trim();
  if (safeVideoId(raw)) return { kind: "video", videoId: raw };
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (!(host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com"))) return null;
    const playlistId = safePlaylistId(url.searchParams.get("list") || "");
    if (playlistId) return { kind: "playlist", playlistId };
    let videoId = "";
    if (host === "youtu.be") videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    else if (url.pathname === "/watch") videoId = url.searchParams.get("v") || "";
    else if (/^\/(embed|shorts|live)\//.test(url.pathname)) videoId = url.pathname.split("/")[2] || "";
    return safeVideoId(videoId) ? { kind: "video", videoId: safeVideoId(videoId) } : null;
  } catch { return null; }
}

function extractYouTubeUrl(value) {
  const text = String(value || "");
  const match = text.match(/https?:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)\/[^\s<>"']+/i);
  return match ? match[0].replace(/[),.;!?]+$/, "") : "";
}
function processIncomingShare() {
  const params = new URLSearchParams(window.location.search);
  const sharedLink = extractYouTubeUrl(params.get("url")) || extractYouTubeUrl(params.get("text")) || extractYouTubeUrl(params.get("title")) || (parseYouTubeLink(params.get("url")) ? params.get("url") : "");
  if (!sharedLink) return;
  // Remove the share payload from the address bar immediately to prevent re-import on refresh.
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash}`);
  const resource = parseYouTubeLink(sharedLink);
  if (!resource) return toast("The shared link was not a recognised YouTube video or playlist");
  pendingIncomingShare = resource;
  if (activeRoomCode && roomIsHost()) importIncomingShare();
  else if (!activeRoomCode) toast("YouTube link received. Create or join a room; the host can add it to the shared playlist.");
  else toast("Only the room host can add videos to the shared playlist.");
}

function importIncomingShare() {
  if (!pendingIncomingShare) return;
  if (!activeRoomCode) return toast("Create or join a room before loading shared content.");
  if (!roomIsHost()) return toast("Only the room host can add videos to the shared playlist.");
  const resource = pendingIncomingShare;
  pendingIncomingShare = null;
  if (resource.kind === "playlist") {
    setSharedPlaylist(resource);
    toast("YouTube playlist received and shared with the room");
    return;
  }
  appendVideoToSharedQueue(resource.videoId);
}


// Firebase is initialized only after the user adds their own public web-app configuration.
if (configReady) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getDatabase(app);
  onValue(ref(db, ".info/serverTimeOffset"), (snapshot) => { serverTimeOffset = snapshot.val() || 0; });
} else {
  setMessage("#authMessage", "Setup required: add your Firebase web-app values in firebase-config.js, then reload.", "error");
  $("#authSubmit").disabled = true;
  $("#signUpTab").disabled = true;
  $("#googleSignInBtn").disabled = true;
}

// Authentication / invite-only membership gate.
function updateAuthMode(mode) {
  authMode = mode;
  const signIn = mode === "signin";
  $("#signInTab").classList.toggle("active", signIn);
  $("#signUpTab").classList.toggle("active", !signIn);
  $("#signInTab").setAttribute("aria-selected", String(signIn));
  $("#signUpTab").setAttribute("aria-selected", String(!signIn));
  $("#displayNameField").classList.toggle("hidden", signIn);
  $("#passwordInput").autocomplete = signIn ? "current-password" : "new-password";
  $("#authSubmit").innerHTML = signIn ? 'Sign in <span aria-hidden="true">↗</span>' : 'Create account <span aria-hidden="true">↗</span>';
  $("#authTitle").innerHTML = signIn ? 'Your people.<br><span>Your watch party.</span>' : 'Make it a<br><span>shared moment.</span>';
  setMessage("#authMessage", "");
}
$("#signInTab").addEventListener("click", () => updateAuthMode("signin"));
$("#signUpTab").addEventListener("click", () => updateAuthMode("signup"));
$("#authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth) return setMessage("#authMessage", "Firebase is not configured yet. See README.md.", "error");
  const email = $("#emailInput").value.trim();
  const password = $("#passwordInput").value;
  const button = $("#authSubmit");
  setBusy(button, true);
  try {
    if (authMode === "signin") {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      const displayName = $("#displayNameInput").value.trim() || email.split("@")[0];
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName });
    }
  } catch (error) {
    const friendly = ({
      "auth/invalid-credential": "Email or password is incorrect.",
      "auth/email-already-in-use": "An account already exists for this email.",
      "auth/weak-password": "Choose a password with at least 6 characters.",
      "auth/invalid-email": "Enter a valid email address.",
      "auth/network-request-failed": "Network error. Check your internet connection."
    })[error.code] || error.message || "Authentication failed.";
    setMessage("#authMessage", friendly, "error");
  } finally { setBusy(button, false); }
});

// Google sign-in uses Firebase Authentication; no separate Google API key is needed.
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
$("#googleSignInBtn").addEventListener("click", async () => {
  if (!auth) return setMessage("#authMessage", "Firebase is not configured yet. See README.md.", "error");
  const button = $("#googleSignInBtn");
  setBusy(button, true, "Connecting to Google…");
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    const friendly = ({
      "auth/popup-closed-by-user": "Google sign-in was closed before it finished.",
      "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow pop-ups and try again.",
      "auth/unauthorized-domain": "This website domain is not authorised in Firebase Authentication settings.",
      "auth/account-exists-with-different-credential": "An account already exists with this email. Sign in using its original method.",
      "auth/network-request-failed": "Network error. Check your internet connection."
    })[error.code] || error.message || "Google sign-in failed.";
    setMessage("#authMessage", friendly, "error");
  } finally { setBusy(button, false); }
});
$("#pendingSignOut").addEventListener("click", () => auth && signOut(auth));
async function handleSignOut() {
  if (!auth) return;
  if (activeRoomCode) await leaveRoom(false);
  await signOut(auth);
}
$("#topSignOutBtn").addEventListener("click", handleSignOut);
$("#copyUidBtn").addEventListener("click", async () => {
  const uid = currentUser?.uid || $("#pendingUid").textContent;
  try { await navigator.clipboard.writeText(uid); toast("Firebase UID copied"); }
  catch { toast("Select and copy your UID manually"); }
});

if (auth) onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    cleanupRoomListeners();
    if (ownerMembersUnsub) { ownerMembersUnsub(); ownerMembersUnsub = null; }
    activeRoomCode = null; roomMeta = null; sharedPlayback = null; memberProfile = null;
    activePresenceRef = null; activePresenceRoomCode = null; isOwner = false; latestParticipants = {}; latestPresence = {};
    showGate("auth");
    return;
  }
  showGate("pending");
  $("#pendingUid").textContent = user.uid;
  try {
    const snapshot = await get(ref(db, `members/${user.uid}`));
    memberProfile = snapshot.exists() ? snapshot.val() : null;
    if (!memberProfile || memberProfile.active !== true) {
      setMessage("#pendingMessage", "Your account is waiting for the owner to approve this UID.");
      showGate("pending");
      return;
    }
    isOwner = memberProfile.role === "owner";
    memberProfile.displayName = memberProfile.displayName || user.displayName || user.email?.split("@")[0] || "Member";
    await openApp();
  } catch (error) {
    setMessage("#pendingMessage", `Could not check membership: ${error.message}. Verify your Realtime Database rules.`, "error");
    showGate("pending");
  }
});

async function openApp() {
  showGate("app");
  const name = userName();
  $("#sidebarName").textContent = name;
  $("#sidebarRole").textContent = isOwner ? "ROOM OWNER" : "MEMBER";
  $("#sidebarAvatar").textContent = initials(name);
  $("#topAvatar").textContent = initials(name);
  $("#ownerPanel").classList.toggle("hidden", !isOwner);
  if (isOwner) listenOwnerMembers();
  loadYouTubeApi();
  updateHostControls();
  setRoomControlsBusy(true);
  try { await restoreSavedRoom(); }
  finally { setRoomControlsBusy(false); }
  processIncomingShare();
}

// Import a YouTube playlist directly. No YouTube Data API key or search quota is used.
function showQueueMessage(title, message) {
  const list = $("#playlistItems");
  list.replaceChildren();
  const empty = document.createElement("div"); empty.className = "queue-empty";
  const mark = document.createElement("span"); mark.className = "queue-empty-mark"; mark.textContent = "♫";
  const heading = document.createElement("strong"); heading.textContent = title;
  const copy = document.createElement("p"); copy.textContent = message;
  empty.append(mark, heading, copy); list.append(empty);
  $("#queueCount").textContent = "0 items";
}
function splitSafeQueue(value) {
  if (Array.isArray(value)) return value.map(safeVideoId).filter(Boolean).slice(0, 100);
  if (typeof value !== "string" || !value) return [];
  return value.split(",").map(safeVideoId).filter(Boolean).slice(0, 100);
}
function hasPlaylistPlayback(playback) {
  return Boolean(safePlaylistId(playback?.playlistId || "") || splitSafeQueue(playback?.queueIds).length || safeVideoId(playback?.videoId || ""));
}
function hasActivePlaylist() { return Boolean(currentPlaylistId || currentQueueIds.length); }
function canHostEditRoom() { return Boolean(activeRoomCode && roomIsHost()); }
function updateHostControls() {
  const canEdit = canHostEditRoom();
  $("#playlistInput").disabled = !canEdit;
  $("#playlistForm button[type=submit]").disabled = !canEdit;
  $("#bulkVideoInput").disabled = !canEdit;
  $("#bulkQueueForm button[type=submit]").disabled = !canEdit;
  $("#bulkQueueBuilder").classList.toggle("host-disabled", !canEdit);
  $("#hostPlaybackControls").classList.toggle("hidden", !canEdit);
  updateMemberStartOverlay();
  if (!canEdit) $("#bulkQueueBuilder").open = false;
  $("#hostNotice").classList.toggle("hidden", !activeRoomCode || roomIsHost());
  $("#hostNotice").textContent = "You are watching the room's shared playlist. Only the host can load videos, change the queue, or control playback.";
  $("#playlistInput").placeholder = canEdit ? "Add a YouTube playlist or video to the room…" : "Only the room host can load videos";
}
function requestSharedPlayback(resource) {
  if (!activeRoomCode) {
    pendingIncomingShare = resource;
    toast("Create or join a room before loading a playlist.");
    openRoomModal("join");
    return;
  }
  if (!roomIsHost()) return toast("Only the room host can change the shared playlist.");
  if (resource.kind === "playlist") setSharedPlaylist(resource);
  else if (resource.kind === "queue") setSharedQueue(resource);
  else setSharedVideo({ videoId: resource.videoId, title: "YouTube video", channel: "Added to the shared room" });
}
$("#playlistForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canHostEditRoom()) return toast(activeRoomCode ? "Only the room host can load videos." : "Create or join a room first.");
  const value = $("#playlistInput").value.trim();
  if (!value) return toast("Paste a YouTube playlist or video link first");
  const resource = parseYouTubeLink(value);
  if (!resource) return toast("That link is not recognised. Use a YouTube video or playlist URL.");
  $("#playlistInput").value = "";
  requestSharedPlayback(resource);
  toast(resource.kind === "playlist" ? "Loading the shared playlist" : "Loading shared video");
});
$("#bulkQueueForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!canHostEditRoom()) return toast(activeRoomCode ? "Only the room host can change the shared queue." : "Create or join a room first.");
  const lines = $("#bulkVideoInput").value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return toast("Add at least one YouTube video link");
  if (lines.length > 100) return toast("A custom queue can contain up to 100 videos");
  const ids = [];
  for (const line of lines) {
    const item = parseYouTubeLink(line);
    if (!item || item.kind !== "video") return toast("Each line must be a single YouTube video link or video ID");
    if (!ids.includes(item.videoId)) ids.push(item.videoId);
  }
  if (!ids.length) return toast("No valid videos found in that list");
  setSharedQueue({ kind: "queue", videoIds: ids, title: "Room playlist queue" });
  $("#bulkVideoInput").value = "";
  $("#bulkQueueBuilder").open = false;
  toast(`Shared ${ids.length} videos with the room`);
});
$("#scrollQueueBtn").addEventListener("click", () => $("#queuePanel").scrollIntoView({ behavior: "smooth", block: "start" }));

// Official YouTube IFrame Player. YouTube hosts the media and owns its playback controls.
function loadYouTubeApi() {
  if (window.YT?.Player) return createPlayer();
  if (document.querySelector('script[data-youtube-iframe-api="1"]')) return;
  const script = document.createElement("script");
  script.src = "https://www.youtube.com/iframe_api";
  script.dataset.youtubeIframeApi = "1";
  script.onerror = () => toast("YouTube player could not load. Check your connection.");
  document.head.append(script);
  window.onYouTubeIframeAPIReady = createPlayer;
}
function createPlayer() {
  if (ytPlayer || !window.YT?.Player) return;
  ytPlayer = new window.YT.Player("player", {
    width: "100%", height: "100%", videoId: "",
    playerVars: { autoplay: 0, controls: 0, disablekb: 1, rel: 0, playsinline: 1, enablejsapi: 1, origin: window.location.origin },
    events: { onReady: () => {
      playerReady = true;
      if (activeRoomCode && hasPlaylistPlayback(sharedPlayback)) applyRemotePlayback(sharedPlayback);
      else {
        showPlayerEmpty(true);
        showQueueMessage("No shared playlist yet", activeRoomCode ? "The host can load a YouTube playlist or add videos to the room." : "Create or join a private room to start watching together.");
      }
    }, onStateChange: onPlayerStateChange, onError: onPlayerError }
  });
}
function showPlayerEmpty(show) { $("#playerEmpty").classList.toggle("hidden", !show); }
function updateNowPlaying(video) {
  if (!video) return;
  currentVideoMeta = { ...video };
  $("#playingTitle").textContent = video.title || "YouTube video";
  $("#playingChannel").textContent = video.channel || "YouTube";
  $("#playingModeLabel").textContent = "SHARED ROOM PLAYBACK";
  $("#openOnYoutubeBtn").disabled = !(video.videoId || currentPlaylistId);
  $("#playerStateBadge").classList.remove("playing");
  $("#playerStateBadge").innerHTML = "<span></span> READY";
  showPlayerEmpty(false);
}

function setPlayerState(state) {
  const badge = $("#playerStateBadge");
  const playing = state === "playing";
  badge.classList.toggle("playing", playing);
  badge.innerHTML = `<span></span> ${state.toUpperCase()}`;
  syncHostPlaybackControls();
}
function refreshCurrentPlaylistPosition() {
  if (!ytPlayer || !hasActivePlaylist()) return;
  try {
    const ids = ytPlayer.getPlaylist?.() || [];
    const index = Number(ytPlayer.getPlaylistIndex?.());
    if (Number.isInteger(index) && index >= 0) currentPlaylistIndex = index;
    const id = ids[currentPlaylistIndex];
    if (safeVideoId(id)) currentVideoId = id;
    const data = ytPlayer.getVideoData?.() || {};
    if (safeVideoId(data.video_id)) currentVideoId = data.video_id;
    $("#openOnYoutubeBtn").disabled = !(currentVideoId || currentPlaylistId);
    if (data.title) {
      currentVideoMeta = { videoId: currentVideoId, title: data.title, channel: data.author || "YouTube playlist" };
      $("#playingTitle").textContent = data.title;
      $("#playingChannel").textContent = `${data.author || "YouTube"} · Episode ${currentPlaylistIndex + 1}`;
    }
    renderPlaylistQueue();
  } catch { /* playlist metadata may not be ready yet */ }
}
function renderPlaylistQueue() {
  const list = $("#playlistItems");
  if (!list) return;
  let ids = [];
  try { ids = hasActivePlaylist() && ytPlayer?.getPlaylist ? (ytPlayer.getPlaylist() || []) : []; } catch { ids = []; }
  list.replaceChildren();
  if (!ids.length) {
    const empty = document.createElement("div"); empty.className = "queue-empty";
    const mark = document.createElement("span"); mark.className = "queue-empty-mark"; mark.textContent = "♫";
    const heading = document.createElement("strong"); heading.textContent = hasActivePlaylist() ? "Loading playlist items…" : "No shared queue yet";
    const copy = document.createElement("p"); copy.textContent = hasActivePlaylist() ? "YouTube is preparing the playlist." : (roomIsHost() ? "Load a playlist or build a queue above." : "The host has not added a playlist yet.");
    empty.append(mark, heading, copy); list.append(empty);
    $("#queueCount").textContent = hasActivePlaylist() ? "Loading" : "0 items";
    return;
  }
  $("#queueCount").textContent = `${ids.length} episodes`;
  ids.slice(0, 100).forEach((id, index) => {
    const item = document.createElement("button"); item.type = "button"; item.className = `queue-item${index === currentPlaylistIndex ? " active" : ""}`;
    item.disabled = !roomIsHost();
    const thumb = document.createElement("img"); thumb.className = "queue-thumb"; thumb.loading = "lazy"; thumb.alt = ""; thumb.src = `https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`;
    const text = document.createElement("span"); text.className = "queue-item-copy";
    const title = document.createElement("strong"); title.textContent = `Episode ${String(index + 1).padStart(2, "0")}`;
    const sub = document.createElement("small"); sub.textContent = index === currentPlaylistIndex ? "Now playing" : (roomIsHost() ? "Play this episode" : "Host controls episode selection");
    text.append(title, sub);
    const play = document.createElement("span"); play.className = "queue-play"; play.textContent = index === currentPlaylistIndex ? "●" : "▶";
    item.append(thumb, text, play);
    item.addEventListener("click", () => {
      if (!roomIsHost()) return toast("Only the room host can change the shared episode");
      if (!ytPlayer) return;
      ytPlayer.playVideoAt(index); currentPlaylistIndex = index;
    });
    list.append(item);
  });
  if (ids.length > 100) {
    const note = document.createElement("p"); note.className = "queue-note"; note.textContent = "Showing the first 100 episodes. Use YouTube's player controls to navigate the full playlist."; list.append(note);
  }
}
function onPlayerStateChange(event) {
  if (event.data === window.YT.PlayerState.PLAYING) setPlayerState("playing");
  else if (event.data === window.YT.PlayerState.PAUSED) setPlayerState("paused");
  else if (event.data === window.YT.PlayerState.ENDED) setPlayerState("ended");
  else if (event.data === window.YT.PlayerState.BUFFERING) setPlayerState("buffering");
  updateMemberStartOverlay();
  if (hasActivePlaylist()) refreshCurrentPlaylistPosition();
  if (!activeRoomCode || !roomIsHost()) {
    // A viewer may tap the video surface, but local pause/play must not break room sync.
    if (activeRoomCode && sharedPlayback) {
      if (sharedPlayback.state === "playing" && event.data === window.YT.PlayerState.PAUSED) ytPlayer.playVideo();
      else if (sharedPlayback.state !== "playing" && event.data === window.YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
    }
    return;
  }
  const state = event.data === window.YT.PlayerState.PLAYING ? "playing" : event.data === window.YT.PlayerState.ENDED ? "ended" : event.data === window.YT.PlayerState.PAUSED ? "paused" : null;
  if (state) {
    if (hasActivePlaylist()) refreshCurrentPlaylistPosition();
    const data = ytPlayer?.getVideoData?.() || {};
    if (safeVideoId(data.video_id)) currentVideoId = data.video_id;
    if (data.title) currentVideoMeta = { videoId: currentVideoId, title: data.title, channel: data.author || "YouTube" };
    publishPlayback(state, safeCurrentTime());
  }
}
function safeCurrentTime() { try { return Math.max(0, Number(ytPlayer?.getCurrentTime?.() || 0)); } catch { return 0; } }
function safePlayerState() { try { return ytPlayer?.getPlayerState?.(); } catch { return -1; } }
function updateMemberStartOverlay() {
  const needsTap = Boolean(activeRoomCode && !roomIsHost() && sharedPlayback?.state === "playing" && safePlayerState() !== window.YT?.PlayerState?.PLAYING);
  $("#memberStartOverlay").classList.toggle("hidden", !needsTap);
}
$("#enablePlaybackBtn").addEventListener("click", () => {
  if (!activeRoomCode || !playerReady || !ytPlayer || !sharedPlayback) return;
  if (sharedPlayback.state === "playing") ytPlayer.playVideo();
  else applyRemotePlayback(sharedPlayback);
  window.setTimeout(updateMemberStartOverlay, 600);
});
function formatPlayerClock(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${minutes}:${String(remainder).padStart(2, "0")}`;
}
function syncHostPlaybackControls() {
  if (!playerReady || !ytPlayer || !canHostEditRoom()) return;
  const duration = Math.max(0, Number(ytPlayer.getDuration?.() || 0));
  const position = Math.max(0, safeCurrentTime());
  $("#currentTimeLabel").textContent = formatPlayerClock(position);
  $("#durationTimeLabel").textContent = formatPlayerClock(duration);
  const seek = $("#playbackSeek");
  if (document.activeElement !== seek && duration > 0) seek.value = String(Math.round(Math.min(1, position / duration) * 1000));
  seek.disabled = duration <= 0;
  const state = safePlayerState();
  $("#hostPlayPauseBtn").textContent = state === window.YT.PlayerState.PLAYING ? "Ⅱ Pause" : "▶ Play";
  let playlistLength = 0;
  try { playlistLength = hasActivePlaylist() ? (ytPlayer.getPlaylist?.() || []).length : 0; } catch { playlistLength = 0; }
  $("#previousVideoBtn").disabled = playlistLength < 2;
  $("#nextVideoBtn").disabled = playlistLength < 2;
}
$("#hostPlayPauseBtn").addEventListener("click", () => {
  if (!canHostEditRoom() || !playerReady || !ytPlayer) return;
  if (safePlayerState() === window.YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
  else ytPlayer.playVideo();
});
$("#previousVideoBtn").addEventListener("click", () => {
  if (!canHostEditRoom() || !playerReady || !ytPlayer) return;
  if (safeCurrentTime() > 3) {
    ytPlayer.seekTo(0, true);
    window.setTimeout(() => publishPlayback(safePlayerState() === window.YT.PlayerState.PLAYING ? "playing" : "paused", 0), 250);
  } else {
    ytPlayer.previousVideo();
    window.setTimeout(refreshCurrentPlaylistPosition, 500);
  }
});
$("#nextVideoBtn").addEventListener("click", () => {
  if (!canHostEditRoom() || !playerReady || !ytPlayer) return;
  ytPlayer.nextVideo();
  window.setTimeout(refreshCurrentPlaylistPosition, 500);
});
$("#playbackSeek").addEventListener("change", (event) => {
  if (!canHostEditRoom() || !playerReady || !ytPlayer) return;
  const duration = Math.max(0, Number(ytPlayer.getDuration?.() || 0));
  if (!duration) return;
  const position = duration * (Number(event.target.value) / 1000);
  ytPlayer.seekTo(position, true);
  window.setTimeout(() => publishPlayback(safePlayerState() === window.YT.PlayerState.PLAYING ? "playing" : "paused", position), 250);
  syncHostPlaybackControls();
});
setInterval(syncHostPlaybackControls, 1000);
function onPlayerError(event) {
  const messages = { 2: "Invalid YouTube video or playlist.", 5: "This video cannot be played in the HTML5 player.", 100: "This video is unavailable or was removed.", 101: "The owner does not allow this video to be embedded.", 150: "The owner does not allow this video to be embedded.", 153: "YouTube did not receive a valid referrer. Open SyncTube using your GitHub Pages URL." };
  toast(messages[event.data] || `YouTube player error (${event.data}).`);
  setPlayerState("unavailable");
}
function setSharedVideo(video) {
  if (!activeRoomCode || !roomIsHost()) return toast("Only the room host can change shared playback");
  const id = safeVideoId(video.videoId);
  if (!id) return toast("That video ID is not valid");
  currentPlaylistId = ""; currentQueueIds = []; currentPlaylistIndex = 0;
  const payload = { videoId: id, videoTitle: boundedText(video.title, 150, "Shared room video"), channelTitle: boundedText(video.channel, 100, "YouTube"), playlistId: "", queueIds: "", playlistIndex: 0, state: "playing", positionSec: 0, updatedAt: serverTimestamp(), updatedBy: currentUser.uid };
  set(ref(db, `rooms/${activeRoomCode}/playback`), payload).then(() => {
    sharedPlayback = { ...payload, updatedAt: Date.now() + serverTimeOffset };
    currentVideoId = id;
    updateNowPlaying(video);
    if (playerReady && ytPlayer) ytPlayer.loadVideoById({ videoId: id });
    renderPlaylistQueue(); toast("Shared video sent to the room");
  }).catch((error) => toast(`Could not update the room: ${error.message}`));
}
function setSharedPlaylist(playlist) {
  if (!activeRoomCode || !roomIsHost()) return toast("Only the room host can change shared playback");
  const id = safePlaylistId(playlist.playlistId);
  if (!id) return toast("That YouTube playlist link is not valid");
  currentPlaylistId = id; currentQueueIds = []; currentPlaylistIndex = 0; currentVideoId = "";
  const payload = { videoId: "", videoTitle: boundedText(playlist.title, 150, "Shared YouTube playlist"), channelTitle: "YouTube playlist", playlistId: id, queueIds: "", playlistIndex: 0, state: "playing", positionSec: 0, updatedAt: serverTimestamp(), updatedBy: currentUser.uid };
  set(ref(db, `rooms/${activeRoomCode}/playback`), payload).then(() => {
    sharedPlayback = { ...payload, updatedAt: Date.now() + serverTimeOffset };
    updateNowPlaying({ title: playlist.title || "Shared YouTube playlist", channel: "Loading episodes from YouTube" });
    if (playerReady && ytPlayer) ytPlayer.loadPlaylist({ listType: "playlist", list: id, index: 0 });
    window.setTimeout(renderPlaylistQueue, 1200);
    toast("Playlist shared with the room");
  }).catch((error) => toast(`Could not share playlist: ${error.message}`));
}
function setSharedQueue(queue) {
  if (!activeRoomCode || !roomIsHost()) return toast("Only the room host can change shared playback");
  const ids = splitSafeQueue(queue.videoIds);
  if (!ids.length) return toast("This custom queue has no valid video IDs");
  const playlistIndex = Math.min(ids.length - 1, Math.max(0, Math.floor(Number(queue.playlistIndex) || 0)));
  const positionSec = Math.max(0, Number(queue.positionSec) || 0);
  const playbackState = queue.state === "paused" ? "paused" : "playing";
  currentPlaylistId = ""; currentQueueIds = ids; currentPlaylistIndex = playlistIndex; currentVideoId = "";
  const payload = { videoId: "", videoTitle: boundedText(queue.title, 150, "Shared custom queue"), channelTitle: "SyncTube playlist", playlistId: "", queueIds: ids.join(","), playlistIndex, state: playbackState, positionSec, updatedAt: serverTimestamp(), updatedBy: currentUser.uid };
  set(ref(db, `rooms/${activeRoomCode}/playback`), payload).then(() => {
    sharedPlayback = { ...payload, updatedAt: Date.now() + serverTimeOffset };
    updateNowPlaying({ title: queue.title || "Shared custom queue", channel: `${ids.length} videos · shared queue` });
    if (playerReady && ytPlayer) {
      ytPlayer.loadPlaylist({ list: ids, index: playlistIndex, startSeconds: positionSec });
      if (playbackState === "paused") window.setTimeout(() => { if (safePlayerState() === window.YT.PlayerState.PLAYING) ytPlayer.pauseVideo(); }, 900);
    }
    window.setTimeout(renderPlaylistQueue, 1200);
    toast("Custom queue shared with the room");
  }).catch((error) => toast(`Could not share queue: ${error.message}`));
}
function appendVideoToSharedQueue(videoId) {
  if (!roomIsHost()) return toast("Only the room host can add videos to the shared queue");
  const id = safeVideoId(videoId);
  if (!id) return toast("That YouTube video link is not valid");
  let ids = currentQueueIds.slice();
  if (currentPlaylistId && playerReady && ytPlayer) {
    try { ids = (ytPlayer.getPlaylist?.() || []).map(safeVideoId).filter(Boolean).slice(0, 100); } catch { ids = []; }
  }
  if (!ids.length && currentVideoId) ids = [currentVideoId];
  if (ids.includes(id)) return toast("That video is already in the shared queue");
  if (ids.length >= 100) return toast("The shared custom queue is full (100 videos)");
  const index = Math.max(0, Math.min(ids.length - 1, currentPlaylistIndex));
  const positionSec = safeCurrentTime();
  ids.push(id);
  setSharedQueue({ videoIds: ids, playlistIndex: index, positionSec, state: sharedPlayback?.state === "paused" ? "paused" : "playing", title: "Shared room queue" });
  toast("Video added to the end of the shared queue");
}
function publishPlayback(state, positionSec) {
  if (!activeRoomCode || !roomIsHost() || (!currentVideoId && !currentPlaylistId && !currentQueueIds.length)) return;
  if (Date.now() - lastPublishAt < 450 && state === "playing") return;
  lastPublishAt = Date.now();
  const payload = { videoId: currentVideoId || "", videoTitle: boundedText(currentVideoMeta?.title || (currentPlaylistId ? "YouTube playlist" : currentQueueIds.length ? "Custom video queue" : "Shared room video"), 150, "Shared room video"), channelTitle: boundedText(currentVideoMeta?.channel || "YouTube", 100, "YouTube"), playlistId: currentPlaylistId || "", queueIds: currentQueueIds.join(","), playlistIndex: hasActivePlaylist() ? Math.max(0, currentPlaylistIndex) : 0, state, positionSec: Math.max(0, Number(positionSec) || 0), updatedAt: serverTimestamp(), updatedBy: currentUser.uid };
  set(ref(db, `rooms/${activeRoomCode}/playback`), payload).catch((error) => toast(`Sync update failed: ${error.message}`));
}
function applyRemotePlayback(playback) {
  if (!playerReady || !ytPlayer || !activeRoomCode || !playback) return;
  const nativePlaylistId = safePlaylistId(playback.playlistId || "");
  const remoteQueueIds = splitSafeQueue(playback.queueIds);
  const isQueue = Boolean(nativePlaylistId || remoteQueueIds.length);
  if (!isQueue && !safeVideoId(playback.videoId || "")) return;
  const serverNow = Date.now() + serverTimeOffset;
  const age = Math.max(0, (serverNow - Number(playback.updatedAt || serverNow)) / 1000);
  const expected = Math.max(0, Number(playback.positionSec || 0) + (playback.state === "playing" ? age : 0));
  const currentState = safePlayerState();
  const drift = Math.abs(safeCurrentTime() - expected);
  if (isQueue) {
    const index = Math.max(0, Math.floor(Number(playback.playlistIndex || 0)));
    const nextQueue = nativePlaylistId ? [] : remoteQueueIds;
    const nextSignature = nativePlaylistId ? `youtube:${nativePlaylistId}` : `custom:${remoteQueueIds.join(",")}`;
    const currentSignature = currentPlaylistId ? `youtube:${currentPlaylistId}` : currentQueueIds.length ? `custom:${currentQueueIds.join(",")}` : "";
    const changed = currentSignature !== nextSignature || currentPlaylistIndex !== index;
    if (changed) {
      currentPlaylistId = nativePlaylistId; currentQueueIds = nextQueue; currentPlaylistIndex = index; currentVideoId = safeVideoId(playback.videoId || "");
      updateNowPlaying({ videoId: currentVideoId, title: playback.videoTitle || "YouTube playlist", channel: playback.channelTitle || `Episode ${index + 1}` });
      const list = nativePlaylistId ? nativePlaylistId : remoteQueueIds;
      ytPlayer.loadPlaylist({ listType: "playlist", list, index, startSeconds: expected });
      if (playback.state !== "playing") window.setTimeout(() => { if (activeRoomCode && safePlayerState() === window.YT.PlayerState.PLAYING) ytPlayer.pauseVideo(); }, 900);
      window.setTimeout(() => { renderPlaylistQueue(); updateMemberStartOverlay(); }, 1300);
      updateMemberStartOverlay();
      return;
    }
    if (safeVideoId(playback.videoId || "") && currentVideoId !== playback.videoId) {
      currentVideoId = playback.videoId;
      const list = nativePlaylistId ? nativePlaylistId : remoteQueueIds;
      ytPlayer.loadPlaylist({ listType: "playlist", list, index, startSeconds: expected });
      return;
    }
  } else {
    if (currentVideoId !== playback.videoId || hasActivePlaylist()) {
      currentPlaylistId = ""; currentQueueIds = []; currentPlaylistIndex = 0; currentVideoId = playback.videoId;
      updateNowPlaying({ videoId: playback.videoId, title: playback.videoTitle || "Shared room video", channel: playback.channelTitle || "Playing in sync" });
      ytPlayer.loadVideoById({ videoId: playback.videoId, startSeconds: expected });
      if (playback.state !== "playing") window.setTimeout(() => { if (activeRoomCode && safePlayerState() === window.YT.PlayerState.PLAYING) ytPlayer.pauseVideo(); }, 600);
      renderPlaylistQueue(); updateMemberStartOverlay(); return;
    }
  }
  if (drift > 2.4) ytPlayer.seekTo(expected, true);
  if (playback.state === "playing" && currentState !== window.YT.PlayerState.PLAYING) ytPlayer.playVideo();
  if (playback.state !== "playing" && currentState === window.YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
  if (playback.state === "ended" && currentState !== window.YT.PlayerState.ENDED) ytPlayer.seekTo(expected, true);
  updateMemberStartOverlay();
}
setInterval(() => {
  if (!activeRoomCode || !hasPlaylistPlayback(sharedPlayback) || !playerReady) return;
  const serverNow = Date.now() + serverTimeOffset;
  const expected = Math.max(0, Number(sharedPlayback.positionSec || 0) + (sharedPlayback.state === "playing" ? Math.max(0, serverNow - Number(sharedPlayback.updatedAt || serverNow)) / 1000 : 0));
  const actual = safeCurrentTime();
  const drift = Math.abs(actual - expected);
  if (roomIsHost()) {
    if (drift > 3.5 && Date.now() - lastPublishAt > 1800) {
      const stateCode = safePlayerState();
      const state = stateCode === window.YT.PlayerState.PLAYING ? "playing" : stateCode === window.YT.PlayerState.ENDED ? "ended" : "paused";
      if (hasActivePlaylist()) refreshCurrentPlaylistPosition();
      publishPlayback(state, actual);
    }
  } else if (drift > 2.8) applyRemotePlayback(sharedPlayback);
}, 3500);
$("#openOnYoutubeBtn").addEventListener("click", () => {
  if (currentPlaylistId) window.open(`https://www.youtube.com/playlist?list=${encodeURIComponent(currentPlaylistId)}`, "_blank", "noopener,noreferrer");
  else if (currentVideoId) window.open(`https://www.youtube.com/watch?v=${encodeURIComponent(currentVideoId)}`, "_blank", "noopener,noreferrer");
});

// Rooms, shared playback, presence and chat.
function roomStorageKey(uid = currentUser?.uid) { return uid ? `synctube:last-room:${uid}` : ""; }
function saveLastRoom(code) {
  // sessionStorage survives reloads but is isolated per browser tab. This prevents
  // two tabs signed in as the same user from overwriting each other's room state.
  try { const key = roomStorageKey(); if (key) sessionStorage.setItem(key, code); } catch { /* storage may be unavailable */ }
}
function clearLastRoom() {
  try { const key = roomStorageKey(); if (key) sessionStorage.removeItem(key); } catch { /* storage may be unavailable */ }
}
function setRoomControlsBusy(busy) {
  ["#createRoomBtn", "#joinRoomBtn", "#roomJoinInline", "#mobileCreateRoomBtn", "#leaveRoomBtn", "#topSignOutBtn", "#accountSignOutBtn"].forEach((selector) => {
    const button = $(selector);
    if (button) button.disabled = Boolean(busy);
  });
}
async function restoreSavedRoom() {
  if (!activeMember() || activeRoomCode || roomActionBusy) return;
  let savedCode = "";
  try { savedCode = sessionStorage.getItem(roomStorageKey()) || ""; } catch { return; }
  if (!/^(?:[A-Z0-9]{6}|[A-Z0-9]{8})$/.test(savedCode)) {
    if (savedCode) clearLastRoom();
    return;
  }
  try {
    await joinRoom(savedCode);
  } catch (error) {
    // Retain the code for temporary network/rules errors; clear only when the room is gone.
    if (/room not found|no longer exists/i.test(error.message || "")) clearLastRoom();
    else toast(`Couldn't reconnect to ${savedCode}: ${error.message || "Check your connection."}`);
  }
}
function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 symbols; each character carries 5 random bits.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => alphabet[byte & 31]).join("");
}
function cleanupRoomListeners() {
  roomUnsubs.forEach((unsubscribe) => { try { unsubscribe(); } catch { /* no-op */ } });
  roomUnsubs = [];
}
function resetRoomUi() {
  activeRoomCode = null; roomMeta = null; sharedPlayback = null;
  activePresenceRef = null; activePresenceRoomCode = null;
  latestParticipants = {}; latestPresence = {};
  currentPlaylistId = ""; currentQueueIds = []; currentPlaylistIndex = 0; currentVideoId = ""; currentVideoMeta = null;
  if (playerReady && ytPlayer) { try { ytPlayer.stopVideo(); } catch { /* player may already be unavailable */ } }
  showPlayerEmpty(true);
  $("#playingTitle").textContent = "Join a room to get started";
  $("#playingChannel").textContent = "The host starts one shared playlist for everyone";
  $("#playingModeLabel").textContent = "ROOM PLAYBACK";
  $("#roomActive").classList.add("hidden");
  $("#roomEmpty").classList.remove("hidden");
  $("#roomTitle").textContent = "No room active";
  $("#roomChip").classList.remove("active");
  $("#roomChipText").textContent = "No room joined";
  $("#roomStatus").classList.remove("active");
  $("#roomStatus").innerHTML = "<i></i> OFFLINE";
  $("#roomRoleValue").textContent = "—";
  $("#onlineCount").textContent = "0";
  $("#memberCount").textContent = "0";
  $("#roomPeople").replaceChildren();
  $("#chatMessages").replaceChildren();
  updateHostControls();
  showQueueMessage("No shared playlist yet", "Create or join a room to start watching together.");
}
async function removePresenceSession(code) {
  if (!activePresenceRef || activePresenceRoomCode !== code) return;
  const presenceRef = activePresenceRef;
  try { await onDisconnect(presenceRef).cancel(); } catch { /* connection may already be closing */ }
  try { await remove(presenceRef); } catch { /* onDisconnect is the fallback */ }
  activePresenceRef = null;
  activePresenceRoomCode = null;
}
function handleRoomListenerError(code, error) {
  console.warn("SyncTube room listener error", error);
  if (activeRoomCode !== code) return;
  if (String(error?.code || "").toUpperCase().includes("PERMISSION_DENIED")) {
    clearLastRoom();
    cleanupRoomListeners();
    void removePresenceSession(code).finally(async () => {
      try { await remove(ref(db, `rooms/${code}/participants/${currentUser.uid}`)); } catch { /* access may already be revoked */ }
      if (activeRoomCode === code) resetRoomUi();
      toast("Your access to this room has ended. Ask the host for a new invite if needed.");
    });
  } else {
    toast(`Room connection issue: ${error?.message || "Check your connection."}`);
  }
}
async function enterRoom(code) {
  cleanupRoomListeners();
  sharedPlayback = null;
  const base = `rooms/${code}`;
  const metaSnap = await get(ref(db, `${base}/meta`));
  const nextRoomMeta = metaSnap.val() || null;
  if (!nextRoomMeta) throw new Error("This room no longer exists.");

  // A separate presence session per tab prevents one tab's disconnect from marking
  // another open tab as offline.
  const sessionKey = push(ref(db, `${base}/presence/${currentUser.uid}`)).key;
  if (!sessionKey) throw new Error("Could not create a presence session. Try again.");
  const presenceRef = ref(db, `${base}/presence/${currentUser.uid}/${sessionKey}`);
  activePresenceRef = presenceRef;
  activePresenceRoomCode = code;
  // Register disconnect cleanup before publishing this session as online.
  await onDisconnect(presenceRef).remove();
  await set(presenceRef, { name: userName(), online: true, seenAt: serverTimestamp() });

  activeRoomCode = code;
  roomMeta = nextRoomMeta;
  roomUnsubs.push(onValue(ref(db, `${base}/meta`), (snap) => {
    roomMeta = snap.val() || null;
    renderRoomMeta();
  }, (error) => handleRoomListenerError(code, error)));

  // Wait for the first playback snapshot so a shared-link import cannot overwrite the queue mid-load.
  await new Promise((resolve, reject) => {
    let initialSnapshot = true;
    let timeoutId = window.setTimeout(() => {
      unsubscribe();
      reject(new Error("Timed out while loading room playback. Check your connection and retry."));
    }, 15000);
    const unsubscribe = onValue(ref(db, `${base}/playback`), (snap) => {
      sharedPlayback = snap.val() || null;
      if (hasPlaylistPlayback(sharedPlayback)) applyRemotePlayback(sharedPlayback);
      else if (playerReady) {
        showPlayerEmpty(true);
        $("#playingTitle").textContent = "Waiting for the host";
        $("#playingChannel").textContent = "The host has not started a video yet";
        $("#playingModeLabel").textContent = "SHARED ROOM PLAYBACK";
        showQueueMessage("No shared playlist yet", roomIsHost() ? "Load a YouTube playlist or add videos to the room." : "The host has not added a playlist yet.");
      }
      if (initialSnapshot) {
        initialSnapshot = false;
        window.clearTimeout(timeoutId);
        resolve();
      }
    }, (error) => {
      window.clearTimeout(timeoutId);
      reject(error);
    });
    roomUnsubs.push(unsubscribe);
  });
  roomUnsubs.push(onValue(ref(db, `${base}/participants`), (snap) => renderParticipants(snap.val() || {}), (error) => handleRoomListenerError(code, error)));
  roomUnsubs.push(onValue(ref(db, `${base}/presence`), (snap) => renderPresence(snap.val() || {}), (error) => handleRoomListenerError(code, error)));
  roomUnsubs.push(onValue(query(ref(db, `${base}/chat`), limitToLast(35)), (snap) => renderChat(snap.val() || {}), (error) => handleRoomListenerError(code, error)));
  renderRoomMeta();
  updateHostControls();
  $("#roomEmpty").classList.add("hidden");
  $("#roomActive").classList.remove("hidden");
  $("#roomChip").classList.add("active");
  $("#roomChipText").textContent = `Room ${code}`;
  $("#roomStatus").classList.add("active");
  $("#roomStatus").innerHTML = "<i></i> LIVE";
  if (playerReady && hasPlaylistPlayback(sharedPlayback)) applyRemotePlayback(sharedPlayback);
  saveLastRoom(code);
  importIncomingShare();
  toast(`Joined room ${code}`);
}
async function createRoom(name) {
  if (!activeMember()) throw new Error("Your account is not approved.");
  if (roomActionBusy) throw new Error("A room action is already in progress. Please wait.");
  roomActionBusy = true; setRoomControlsBusy(true);
  let code = "", metaCreated = false, participantAdded = false;
  try {
    if (activeRoomCode) await leaveRoom(false);
    for (let attempt = 0; attempt < 8; attempt++) {
      code = makeRoomCode();
      const existing = await get(ref(db, `rooms/${code}/meta`));
      if (!existing.exists()) break;
      code = "";
    }
    if (!code) throw new Error("Could not reserve a room code. Try again.");
    const safeRoomName = String(name || "The Watch Lounge").trim().slice(0, 40) || "The Watch Lounge";
    await set(ref(db, `rooms/${code}/meta`), { ownerUid: currentUser.uid, name: safeRoomName, createdAt: serverTimestamp() });
    metaCreated = true;
    await set(ref(db, `rooms/${code}/participants/${currentUser.uid}`), true);
    participantAdded = true;
    await set(ref(db, `rooms/${code}/playback`), { videoId: "", videoTitle: "", channelTitle: "", playlistId: "", queueIds: "", playlistIndex: 0, state: "paused", positionSec: 0, updatedAt: serverTimestamp(), updatedBy: currentUser.uid });
    await enterRoom(code);
  } catch (error) {
    if (code) {
      cleanupRoomListeners();
      await removePresenceSession(code);
      if (metaCreated) {
        // Playback deletion is owner-only and also requires the host to remain a
        // participant, so remove it before removing the participant record.
        try { await remove(ref(db, `rooms/${code}/playback`)); } catch { /* playback may not have been created */ }
      }
      if (participantAdded) { try { await remove(ref(db, `rooms/${code}/participants/${currentUser.uid}`)); } catch { /* report original failure */ } }
      if (metaCreated) {
        try { await remove(ref(db, `rooms/${code}/meta`)); } catch { /* owner cleanup may be blocked by stale rules */ }
      }
      if (activeRoomCode === code) resetRoomUi();
    }
    throw error;
  } finally {
    roomActionBusy = false; setRoomControlsBusy(false);
  }
}
async function joinRoom(codeValue) {
  if (!activeMember()) throw new Error("Your account is not approved.");
  if (roomActionBusy) throw new Error("A room action is already in progress. Please wait.");
  const code = String(codeValue || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^(?:[A-Z0-9]{6}|[A-Z0-9]{8})$/.test(code)) throw new Error("Enter a valid 6- or 8-character room code.");
  roomActionBusy = true; setRoomControlsBusy(true);
  let participantAdded = false;
  try {
    const metaSnap = await get(ref(db, `rooms/${code}/meta`));
    if (!metaSnap.exists()) throw new Error("Room not found. Check the code with your friend.");
    if (activeRoomCode === code) { toast(`You're already in room ${code}`); return; }
    if (activeRoomCode) await leaveRoom(false);
    await set(ref(db, `rooms/${code}/participants/${currentUser.uid}`), true);
    participantAdded = true;
    await enterRoom(code);
  } catch (error) {
    // Do not tear down listeners for an already-active room when validation of a different
    // target room fails before the current room has been left.
    if (activeRoomCode === code) cleanupRoomListeners();
    await removePresenceSession(code);
    if (participantAdded) {
      try { await remove(ref(db, `rooms/${code}/participants/${currentUser.uid}`)); }
      catch { /* New database rules allow members to remove their own participant record. */ }
    }
    if (activeRoomCode === code) resetRoomUi();
    throw error;
  } finally {
    roomActionBusy = false; setRoomControlsBusy(false);
  }
}
async function leaveRoom(showToast = true) {
  if (!activeRoomCode) return;
  const oldCode = activeRoomCode;
  clearLastRoom();
  cleanupRoomListeners();
  await removePresenceSession(oldCode);
  let membershipRemoved = true;
  let anotherTabIsPresent = false;
  try {
    // The participant record is shared by all tabs signed in as this UID.
    // Preserve it while another tab still has an online presence session.
    const sessionsSnap = await get(ref(db, `rooms/${oldCode}/presence/${currentUser.uid}`));
    const sessions = sessionsSnap.val();
    if (sessions && typeof sessions === "object") {
      if (sessions.online === true) anotherTabIsPresent = true; // older client session shape
      else anotherTabIsPresent = Object.values(sessions).some((session) => session && typeof session === "object" && session.online === true);
    }
  } catch (error) {
    membershipRemoved = false;
    console.warn("Could not check other tab sessions; keeping room membership to avoid disconnecting another tab.", error);
  }
  if (membershipRemoved && !anotherTabIsPresent) {
    try { await remove(ref(db, `rooms/${oldCode}/participants/${currentUser.uid}`)); }
    catch (error) { membershipRemoved = false; console.warn("Could not revoke participant record; publish the included database rules.", error); }
  }
  resetRoomUi();
  if (showToast) {
    if (anotherTabIsPresent) toast(`Closed this tab. Another tab is still in room ${oldCode}.`);
    else toast(membershipRemoved ? `Left room ${oldCode}` : `Left locally. Room membership was kept because its status could not be verified.`);
  }
}
function renderRoomMeta() {
  if (!activeRoomCode) return;
  $("#roomTitle").textContent = roomMeta?.name || "Watch room";
  $("#roomCodeDisplay").textContent = activeRoomCode;
  $("#roomStatus").classList.add("active");
  $("#roomStatus").innerHTML = "<i></i> LIVE";
  $("#roomRoleValue").textContent = roomIsHost() ? "HOST" : "MEMBER";
  updateHostControls();
}

let latestParticipants = {}, latestPresence = {};
function renderParticipants(participants) {
  latestParticipants = participants || {};
  const count = Object.keys(latestParticipants).length;
  $("#memberCount").textContent = String(count);
  $("#onlineCount").textContent = String(Object.keys(latestParticipants).filter((uid) => presenceSessions(uid).some((session) => session.online === true)).length);
  renderPeople();
}
function presenceSessions(uid) {
  const value = latestPresence[uid];
  if (!value) return [];
  // Support old presence/{uid} records while new clients use presence/{uid}/{sessionId}.
  if (typeof value === "object" && typeof value.online === "boolean") return [value];
  return Object.values(value).filter((session) => session && typeof session === "object");
}
function bestPresence(uid) {
  return presenceSessions(uid).sort((a, b) => Number(b.seenAt || 0) - Number(a.seenAt || 0))[0] || null;
}
function renderPresence(presence) {
  latestPresence = presence || {};
  const onlineUsers = Object.keys(latestParticipants).filter((uid) => presenceSessions(uid).some((session) => session.online === true)).length;
  $("#onlineCount").textContent = String(onlineUsers);
  renderPeople();
}
function renderPeople() {
  const node = $("#roomPeople"); node.replaceChildren();
  const entries = Object.keys(latestParticipants).slice(0, 16);
  if (!entries.length) return;
  entries.forEach((uid) => {
    const sessions = presenceSessions(uid);
    const online = sessions.some((session) => session.online === true);
    const presence = sessions.filter((session) => session.online === true).sort((a, b) => Number(b.seenAt || 0) - Number(a.seenAt || 0))[0] || bestPresence(uid);
    const pill = document.createElement("span"); pill.className = "person-pill";
    const dot = document.createElement("i");
    if (!online) dot.style.background = "#6d6a80";
    const name = document.createElement("span"); name.textContent = presence?.name || `${uid.slice(0, 6)}…`;
    pill.append(dot, name); node.append(pill);
  });
}
function renderChat(messages) {
  const box = $("#chatMessages"); box.replaceChildren();
  const entries = Object.entries(messages).sort((a, b) => (a[1]?.createdAt || 0) - (b[1]?.createdAt || 0));
  if (!entries.length) { const placeholder = document.createElement("div"); placeholder.className = "chat-placeholder"; placeholder.textContent = "Say hello to the room."; box.append(placeholder); return; }
  entries.forEach(([, message]) => {
    const line = document.createElement("div"); line.className = "chat-message";
    const author = document.createElement("strong"); author.textContent = message.name || "Member";
    const body = document.createElement("span"); body.textContent = message.text || "";
    const time = document.createElement("time"); time.textContent = formatTime(message.createdAt);
    line.append(author, body, time); box.append(line);
  });
  box.scrollTop = box.scrollHeight;
}
$("#chatForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!activeRoomCode) return toast("Join a room before chatting");
  const textValue = $("#chatInput").value.trim().slice(0, 240);
  if (!textValue) return;
  const remaining = 1200 - (Date.now() - lastChatSentAt);
  if (remaining > 0) return toast("Please wait a moment before sending another message.");
  const sendButton = $("#chatForm button[type=submit]");
  sendButton.disabled = true;
  try {
    const messageRef = push(ref(db, `rooms/${activeRoomCode}/chat`));
    await set(messageRef, { uid: currentUser.uid, name: userName(), text: textValue, createdAt: serverTimestamp() });
    lastChatSentAt = Date.now();
    $("#chatInput").value = "";
  } catch (error) { toast(`Message was not sent: ${error.message}`); }
  finally { sendButton.disabled = false; }
});
$("#leaveRoomBtn").addEventListener("click", () => leaveRoom());
$("#copyRoomCodeBtn").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(activeRoomCode || ""); toast("Room code copied"); }
  catch { toast(`Room code: ${activeRoomCode}`); }
});

// Room modal actions.
let roomModalMode = "create";
function openRoomModal(mode) {
  roomModalMode = mode;
  const create = mode === "create";
  $("#roomModalTitle").textContent = create ? "Create your room" : "Join your crew";
  $("#roomModalCopy").textContent = create ? "Give your room a name your friends will recognise." : "Enter the invite code shared by your host (new codes have 8 characters).";
  $("#roomNameWrap").classList.toggle("hidden", !create);
  $("#roomCodeWrap").classList.toggle("hidden", create);
  $("#roomModalSubmit").innerHTML = create ? 'Create room <span>↗</span>' : 'Join room <span>↗</span>';
  setMessage("#roomModalMessage", "");
  $("#roomModal").classList.remove("hidden");
  setTimeout(() => (create ? $("#roomNameInput") : $("#roomCodeInput")).focus(), 20);
}
function closeRoomModal() { $("#roomModal").classList.add("hidden"); }
$("#createRoomBtn").addEventListener("click", () => openRoomModal("create"));
$("#joinRoomBtn").addEventListener("click", () => openRoomModal("join"));
$("#roomJoinInline").addEventListener("click", () => openRoomModal("join"));
$$("[data-close-modal]").forEach((button) => button.addEventListener("click", closeRoomModal));
$("#roomModal").addEventListener("click", (event) => { if (event.target === $("#roomModal")) closeRoomModal(); });
$("#roomModalForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("#roomModalSubmit"); setBusy(button, true);
  try {
    if (roomModalMode === "create") await createRoom($("#roomNameInput").value.trim());
    else await joinRoom($("#roomCodeInput").value.trim());
    closeRoomModal();
  } catch (error) { setMessage("#roomModalMessage", error.message || "Room action failed.", "error"); }
  finally { setBusy(button, false); }
});

// Mobile navigation and player settings.
function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  $$(".bottom-nav-item").forEach((item) => item.classList.toggle("active", item.dataset.scrollTarget === id));
  $$(".category-chip").forEach((item) => item.classList.toggle("active", item.dataset.scrollTarget === id));
}
$$('[data-scroll-target]').forEach((button) => button.addEventListener("click", () => scrollToSection(button.dataset.scrollTarget)));
$("#mobileCreateRoomBtn").addEventListener("click", () => openRoomModal("create"));
$("#mobileProfileBtn").addEventListener("click", openAccountSheet);
function openPlayerSettings() {
  settingsReturnFocus = document.activeElement;
  $("#settingsHostHint").textContent = roomIsHost() ? "You control playback for everyone in this room." : "The room host controls play, pause and seeking.";
  $("#playerSettingsSheet").classList.remove("hidden");
  document.body.classList.add("sheet-open");
  $("#closePlayerSettingsBtn").focus();
}
function closePlayerSettings() {
  $("#playerSettingsSheet").classList.add("hidden");
  if ($("#accountSheet").classList.contains("hidden")) document.body.classList.remove("sheet-open");
  settingsReturnFocus?.focus?.();
  settingsReturnFocus = null;
}
function openAccountSheet() {
  accountReturnFocus = document.activeElement;
  $("#accountDisplayName").textContent = userName();
  $("#accountEmail").textContent = currentUser?.email || "Signed-in account";
  $("#accountRole").textContent = isOwner ? "Owner" : activeMember() ? "Approved member" : "Guest";
  $("#accountUid").textContent = currentUser?.uid || "Unavailable";
  $("#accountSheet").classList.remove("hidden");
  document.body.classList.add("sheet-open");
  $("#closeAccountSheetBtn").focus();
}
function closeAccountSheet() {
  $("#accountSheet").classList.add("hidden");
  if ($("#playerSettingsSheet").classList.contains("hidden")) document.body.classList.remove("sheet-open");
  accountReturnFocus?.focus?.();
  accountReturnFocus = null;
}
$("#playerSettingsBtn").addEventListener("click", openPlayerSettings);
$("#closePlayerSettingsBtn").addEventListener("click", closePlayerSettings);
$("#playerSettingsSheet").addEventListener("click", (event) => { if (event.target === $("#playerSettingsSheet")) closePlayerSettings(); });
$("#playerFullscreenBtn").addEventListener("click", async () => {
  const frame = $("#playerFrame");
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (frame.requestFullscreen) await frame.requestFullscreen();
    else toast("Fullscreen is not supported by this browser.");
  } catch { toast("Could not open fullscreen. Try your browser's fullscreen option."); }
});
$("#closeAccountSheetBtn").addEventListener("click", closeAccountSheet);
$("#accountSheet").addEventListener("click", (event) => { if (event.target === $("#accountSheet")) closeAccountSheet(); });
$("#accountCopyUidBtn").addEventListener("click", async () => {
  const uid = currentUser?.uid || "";
  if (!uid) return;
  try { await navigator.clipboard.writeText(uid); toast("Firebase UID copied"); }
  catch { toast(`UID: ${uid}`); }
});
$("#accountSignOutBtn").addEventListener("click", async () => { closeAccountSheet(); await handleSignOut(); });


// Owner-only global allowlist management. New users register first, then share their UID.
async function listenOwnerMembers() {
  if (!isOwner) return;
  if (ownerMembersUnsub) ownerMembersUnsub();
  ownerMembersUnsub = onValue(ref(db, "members"), (snapshot) => {
    const members = snapshot.val() || {};
    const list = $("#memberList"); list.replaceChildren();
    Object.entries(members).slice(0, 30).forEach(([uid, member]) => {
      const row = document.createElement("div"); row.className = "member-item";
      const id = document.createElement("span"); id.textContent = `${uid.slice(0, 9)}…`;
      const role = document.createElement("span"); role.textContent = member.role === "owner" ? "OWNER" : member.active ? "ACTIVE" : "PAUSED";
      row.append(id, role); list.append(row);
    });
  }, (error) => setMessage("#ownerMessage", `Member list error: ${error.message}`, "error"));
}
$("#addMemberForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isOwner) return;
  const uid = $("#memberUidInput").value.trim();
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(uid)) return setMessage("#ownerMessage", "That UID format does not look valid.", "error");
  if (uid === currentUser.uid) return setMessage("#ownerMessage", "You are already the owner.", "error");
  const button = $("#addMemberForm button[type=submit]"); setBusy(button, true, "Adding…");
  try {
    await set(ref(db, `members/${uid}`), { active: true, role: "member", addedBy: currentUser.uid, createdAt: serverTimestamp() });
    $("#memberUidInput").value = "";
    setMessage("#ownerMessage", "Member approved. They can now sign in and join rooms.", "success");
  } catch (error) { setMessage("#ownerMessage", `Could not approve member: ${error.message}`, "error"); }
  finally { setBusy(button, false); }
});

// PWA install prompt: browsers that support beforeinstallprompt can expose an in-app install button.
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  $("#installAppBtn").classList.remove("hidden");
});
$("#installAppBtn").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return toast("Open the browser menu and choose Install app or Add to Home screen");
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $("#installAppBtn").classList.add("hidden");
});
window.addEventListener("appinstalled", () => {
  $("#installAppBtn").classList.add("hidden");
  toast("SyncTube installed. You can now share YouTube links to it.");
});


function updateOfflineBanner() {
  $("#offlineBanner").classList.toggle("hidden", navigator.onLine);
}
updateOfflineBanner();
window.addEventListener("offline", updateOfflineBanner);
window.addEventListener("online", () => {
  updateOfflineBanner();
  toast("Connection restored");
});
$("#offlineRetryBtn").addEventListener("click", () => {
  if (!navigator.onLine) return toast("Still offline. Check your connection and retry.");
  window.location.reload();
});

// Initial UI state and basic keyboard conveniences.
showGate(configReady ? "auth" : "auth");
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => { /* share-to-app requires an installable PWA; app remains usable without SW */ });
}
showQueueMessage("No shared playlist yet", "Create or join a room. The host can load a playlist or add videos to the room.");
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeRoomModal(); closePlayerSettings(); closeAccountSheet();
  }
  const activeSheet = !$("#playerSettingsSheet").classList.contains("hidden") ? $("#playerSettingsSheet") : !$("#accountSheet").classList.contains("hidden") ? $("#accountSheet") : null;
  if (event.key === "Tab" && activeSheet) {
    const focusable = [...activeSheet.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((node) => node.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
