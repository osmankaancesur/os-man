/* ================================================================
   music-player.js – Audio engine with HTML5 Audio & Web Audio API
   ================================================================ */

// ---------------------------------------------------------------------------
// Playlist — placeholder tracks (using public domain / free sound URLs)
// ---------------------------------------------------------------------------
const playlist = []; // Add tracks you own to public/ and list them here.

// ---------------------------------------------------------------------------
// LocalStorage helpers
// ---------------------------------------------------------------------------
const LS_KEYS = {
  volume: "music_volume",
  shuffle: "music_shuffle",
  repeat: "music_repeat",
  track: "music_track",
};

function loadState(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveState(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ---------------------------------------------------------------------------
// Event emitter mixin
// ---------------------------------------------------------------------------
function createEmitter() {
  const listeners = new Map();
  return {
    on(event, callback) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(callback);
    },
    off(event, callback) {
      const set = listeners.get(event);
      if (set) set.delete(callback);
    },
    _emit(event, data) {
      const set = listeners.get(event);
      if (!set) return;
      for (const fn of set) {
        try {
          fn(data);
        } catch (err) {
          console.error(`[music-player] listener error (${event}):`, err);
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Music Player singleton
// ---------------------------------------------------------------------------
const musicPlayer = (() => {
  const emitter = createEmitter();

  // --- Persisted state ---
  let volume = loadState(LS_KEYS.volume, 0.7);
  let shuffle = loadState(LS_KEYS.shuffle, false);
  let repeatMode = loadState(LS_KEYS.repeat, "off"); // 'off' | 'all' | 'one'
  let currentIndex = loadState(LS_KEYS.track, 0);
  if (currentIndex >= playlist.length || currentIndex < 0) currentIndex = 0;

  // --- HTML5 Audio Element ---
  const audio = new Audio();
  audio.preload = "none";
  audio.crossOrigin = "anonymous"; // For Web Audio API cross-origin
  audio.volume = volume;

  // --- Shuffle state ---
  let shuffledIndices = [];

  // --- Web Audio Nodes (for EQ) ---
  let audioCtx = null;
  let analyserNode = null;
  let sourceNode = null;
  let freqData = null;

  function ensureContext() {
    if (audioCtx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return; // Browser doesn't support Web Audio

    audioCtx = new AudioContext();
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 256;
    freqData = new Uint8Array(analyserNode.frequencyBinCount);

    try {
      sourceNode = audioCtx.createMediaElementSource(audio);
      sourceNode.connect(analyserNode);
      analyserNode.connect(audioCtx.destination);
    } catch (e) {
      console.warn("Could not connect audio to Web Audio API", e);
    }
  }

  // --- Helpers ---
  function buildShuffleOrder() {
    shuffledIndices = playlist.map((_, i) => i);
    for (let i = shuffledIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledIndices[i], shuffledIndices[j]] = [
        shuffledIndices[j],
        shuffledIndices[i],
      ];
    }
  }

  function resolveIndex(pos) {
    if (!shuffle) return pos;
    return shuffledIndices[pos] ?? pos;
  }

  function positionOf(index) {
    if (!shuffle) return index;
    return shuffledIndices.indexOf(index);
  }

  function loadTrack(index) {
    currentIndex = index;
    saveState(LS_KEYS.track, currentIndex);
    const track = playlist[currentIndex];
    if (track) {
      audio.src = track.url;
      audio.load();
      emitter._emit("trackchange", { track, index });
    }
  }

  function playInternal() {
    if (!playlist.length) return;
    ensureContext();
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn("Autoplay blocked or playback failed:", err);
        emitter._emit("pause"); // Sync UI to paused
      });
    }
  }

  // --- Event Bindings ---
  audio.addEventListener("play", () => {
    emitter._emit("play");
  });

  audio.addEventListener("pause", () => {
    emitter._emit("pause");
  });

  audio.addEventListener("timeupdate", () => {
    emitter._emit("timeupdate", {
      currentTime: audio.currentTime,
      duration: audio.duration || 0,
    });
  });

  audio.addEventListener("ended", () => {
    emitter._emit("ended");
    if (repeatMode === "one") {
      audio.currentTime = 0;
      playInternal();
    } else {
      const pos = positionOf(currentIndex);
      const nextPos = pos + 1;
      if (nextPos < playlist.length) {
        loadTrack(resolveIndex(nextPos));
        playInternal();
      } else if (repeatMode === "all") {
        if (shuffle) buildShuffleOrder();
        loadTrack(resolveIndex(0));
        playInternal();
      }
      // 'off' mode at the end: do nothing, audio naturally stops.
    }
  });

  // Init shuffle and first track
  if (shuffle) buildShuffleOrder();
  loadTrack(currentIndex);

  // --- Public API ---
  return {
    on: emitter.on,
    off: emitter.off,

    async play(index) {
      if (!playlist.length) return;
      if (index !== undefined && index !== null && index !== currentIndex) {
        loadTrack(index);
      }
      playInternal();
    },

    pause() {
      audio.pause();
    },

    stop() {
      audio.pause();
      audio.currentTime = 0;
      emitter._emit("stop");
    },

    async next() {
      if (!playlist.length) return;
      const pos = positionOf(currentIndex);
      let nextPos = pos + 1;
      if (nextPos >= playlist.length) {
        if (shuffle) buildShuffleOrder();
        nextPos = 0;
      }
      loadTrack(resolveIndex(nextPos));
      playInternal();
    },

    async prev() {
      if (!playlist.length) return;
      const pos = positionOf(currentIndex);
      let prevPos = pos - 1;
      if (prevPos < 0) prevPos = playlist.length - 1;
      loadTrack(resolveIndex(prevPos));
      playInternal();
    },

    seek(fraction) {
      const clamped = Math.max(0, Math.min(1, fraction));
      if (audio.duration) {
        audio.currentTime = clamped * audio.duration;
      }
    },

    setVolume(fraction) {
      volume = Math.max(0, Math.min(1, fraction));
      audio.volume = volume;
      saveState(LS_KEYS.volume, volume);
      emitter._emit("volumechange", { volume });
    },

    getVolume() {
      return volume;
    },

    toggleShuffle() {
      shuffle = !shuffle;
      if (shuffle) buildShuffleOrder();
      saveState(LS_KEYS.shuffle, shuffle);
    },

    isShuffled() {
      return shuffle;
    },

    cycleRepeat() {
      const cycle = { off: "all", all: "one", one: "off" };
      repeatMode = cycle[repeatMode] || "off";
      saveState(LS_KEYS.repeat, repeatMode);
    },

    getRepeatMode() {
      return repeatMode;
    },
    getPlaylist() {
      return playlist;
    },
    getCurrentTrack() {
      return playlist[currentIndex] ?? null;
    },
    getCurrentIndex() {
      return currentIndex;
    },
    isPlaying() {
      return !audio.paused;
    },
    getCurrentTime() {
      return audio.currentTime;
    },
    getDuration() {
      return audio.duration || 0;
    },

    getAnalyserData() {
      if (!analyserNode || !freqData) {
        return new Uint8Array(128);
      }
      analyserNode.getByteFrequencyData(freqData);
      return freqData;
    },
  };
})();

export { musicPlayer };
