/**
 * Centralized Audio Manager Singleton for ChatAppey
 * Ensures single active audio instance across Stories, Group Vibes, Music Picker, Playlist, and Listen Together.
 */

class AudioManager {
  constructor() {
    this.currentAudio = null;
    this.currentSourceId = null;
    this.listeners = new Set();
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);

    if (typeof window !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
    }
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.pauseAll();
    }
  }

  play({ id, url, volume = 1, loop = false, onEnded = null, onError = null }) {
    if (!url) return null;

    // Stop current audio if playing a different source
    if (this.currentAudio && this.currentSourceId !== id) {
      this.stop();
    }

    if (!this.currentAudio || this.currentSourceId !== id) {
      const audio = new Audio(url);
      audio.volume = Math.min(1, Math.max(0, volume));
      audio.loop = loop;

      if (onEnded) {
        audio.onended = () => {
          this.notifyState("ended", id);
          onEnded();
        };
      }

      if (onError) {
        audio.onerror = (e) => {
          this.notifyState("error", id);
          onError(e);
        };
      }

      this.currentAudio = audio;
      this.currentSourceId = id;
    }

    const playPromise = this.currentAudio.play();
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

    return this.currentAudio;
  }

  pause() {
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
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
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.removeAttribute("src");
        this.currentAudio.load();
      } catch (e) {
        // ignore cleanup error
      }
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
      const applySeek = () => {
        try {
          if (this.currentAudio && this.currentAudio.duration >= seconds) {
            this.currentAudio.currentTime = seconds;
          }
        } catch (e) {
          console.warn("AudioManager seek error:", e.message);
        }
      };

      if (this.currentAudio.readyState >= 1) {
        applySeek();
      } else {
        this.currentAudio.addEventListener("loadedmetadata", applySeek, { once: true });
        this.currentAudio.addEventListener("canplay", applySeek, { once: true });
      }
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
      } catch (e) {
        // ignore listener error
      }
    }
  }
}

export const audioManager = new AudioManager();
