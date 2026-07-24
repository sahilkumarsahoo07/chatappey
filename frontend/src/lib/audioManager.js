/**
 * Centralized Audio Manager Singleton for ChatAppey
 * Reuses audio engine, handles pre-buffering, clip looping, and real-time playback/buffer event hooks.
 */

class AudioManager {
  constructor() {
    this.currentAudio = null;
    this.currentSourceId = null;
    this.preloadPool = new Map(); // url -> Audio element
    this.listeners = new Set();
    this.eventCleanup = null;
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    if (typeof window !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.wasPlayingBeforeHide = Boolean(this.currentAudio && !this.currentAudio.paused);
      this.pauseAll();
    } else if (this.wasPlayingBeforeHide) {
      this.resume();
    }
  }

  preloadAudio(url) {
    if (!url || typeof window === "undefined") return null;
    if (this.preloadPool.has(url)) return this.preloadPool.get(url);

    try {
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = url;
      this.preloadPool.set(url, audio);

      // Keep preload pool under 15 items
      if (this.preloadPool.size > 15) {
        const oldestKey = this.preloadPool.keys().next().value;
        const oldestAudio = this.preloadPool.get(oldestKey);
        if (oldestAudio) {
          oldestAudio.removeAttribute("src");
          oldestAudio.load();
        }
        this.preloadPool.delete(oldestKey);
      }
      return audio;
    } catch (e) {
      console.warn("preloadAudio error:", e);
      return null;
    }
  }

  play({
    id,
    url,
    volume = 1,
    loop = true,
    clipStart = 0,
    clipDuration = 0,
    onPlaying = null,
    onWaiting = null,
    onTimeUpdate = null,
    onEnded = null,
    onError = null,
  }) {
    if (!url) return null;

    // Clean up previous event listeners
    if (this.eventCleanup) {
      this.eventCleanup();
      this.eventCleanup = null;
    }

    // Stop current audio if playing a different source
    if (this.currentAudio && this.currentSourceId !== id) {
      this.pause();
    }

    let audio = this.preloadPool.get(url);
    if (!audio) {
      audio = new Audio(url);
      audio.preload = "auto";
    }

    audio.volume = Math.min(1, Math.max(0, volume));
    audio.loop = loop && (!clipDuration || clipDuration <= 0);

    const startSec = Number(clipStart || 0);
    const durationSec = Number(clipDuration || 0);
    const endSec = durationSec > 0 ? startSec + durationSec : 0;

    // Fast initial seek
    if (startSec > 0) {
      try {
        if (audio.readyState >= 1) {
          audio.currentTime = startSec;
        } else {
          audio.addEventListener("loadedmetadata", () => { audio.currentTime = startSec; }, { once: true });
        }
      } catch (e) {}
    }

    // Event listeners
    const handlePlaying = () => {
      this.notifyState("playing", id);
      if (onPlaying) onPlaying();
    };

    const handleWaiting = () => {
      this.notifyState("buffering", id);
      if (onWaiting) onWaiting();
    };

    const handleTimeUpdate = () => {
      if (onTimeUpdate) onTimeUpdate(audio.currentTime);
      // Custom Clip Loop Bound handling
      if (endSec > 0 && audio.currentTime >= endSec) {
        if (loop) {
          audio.currentTime = startSec;
        } else {
          audio.pause();
          if (onEnded) onEnded();
        }
      }
    };

    const handleEnded = () => {
      this.notifyState("ended", id);
      if (onEnded) onEnded();
    };

    const handleError = (e) => {
      this.notifyState("error", id);
      if (onError) onError(e);
    };

    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    this.eventCleanup = () => {
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };

    this.currentAudio = audio;
    this.currentSourceId = id;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.notifyState("playing", id);
        })
        .catch((err) => {
          console.warn("AudioManager play error:", err.message);
          this.notifyState("paused", id);
        });
    }

    return audio;
  }

  pause() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
      } catch (e) {}
      this.notifyState("paused", this.currentSourceId);
    }
  }

  resume() {
    if (this.currentAudio && this.currentAudio.paused) {
      const p = this.currentAudio.play();
      if (p !== undefined) {
        p.then(() => this.notifyState("playing", this.currentSourceId)).catch(() => {});
      }
    }
  }

  stop() {
    if (this.eventCleanup) {
      this.eventCleanup();
      this.eventCleanup = null;
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      const prevId = this.currentSourceId;
      this.currentAudio = null;
      this.currentSourceId = null;
      this.notifyState("stopped", prevId);
    }
  }

  pauseAll() {
    this.pause();
  }

  setVolume(vol) {
    if (this.currentAudio) {
      this.currentAudio.volume = Math.min(1, Math.max(0, vol));
    }
  }

  seek(seconds) {
    if (this.currentAudio && Number.isFinite(seconds) && seconds >= 0) {
      try {
        if (this.currentAudio.readyState >= 1) {
          this.currentAudio.currentTime = seconds;
        } else {
          this.currentAudio.addEventListener(
            "loadedmetadata",
            () => {
              if (this.currentAudio) this.currentAudio.currentTime = seconds;
            },
            { once: true }
          );
        }
      } catch (e) {}
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyState(state, sourceId) {
    for (const listener of this.listeners) {
      try {
        listener({ state, sourceId });
      } catch (e) {}
    }
  }
}

export const audioManager = new AudioManager();
