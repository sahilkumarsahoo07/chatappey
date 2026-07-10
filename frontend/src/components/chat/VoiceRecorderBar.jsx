import { memo } from "react";
import { Lock, Send, Trash2, ChevronLeft, Square } from "lucide-react";
import { formatVoiceDuration } from "../../hooks/useVoiceRecorder";
import "./VoiceRecorder.css";

/**
 * WhatsApp-style recording strip (waveform + timer + slide-to-cancel).
 * Mic button stays outside this component (MessageInput).
 */
function VoiceRecorderBar({
  duration,
  levels = [],
  slideX = 0,
  cancelProgress = 0,
  lockProgress = 0,
  isLocked = false,
  previewUrl = null,
  onCancel,
  onSend,
  onStopToPreview,
}) {
  const lockedOrPreview = isLocked || Boolean(previewUrl);

  return (
    <div className="voice-rec-bar" role="status" aria-live="polite">
      {/* Lock hint above mic (right side) */}
      {!lockedOrPreview && (
        <div
          className={`voice-rec-lock-rail ${lockProgress > 0.2 ? "voice-rec-lock-rail--active" : ""}`}
          style={{ opacity: 0.4 + lockProgress * 0.6 }}
          aria-hidden
        >
          <div className={`voice-rec-lock-icon ${lockProgress > 0.85 ? "voice-rec-lock-icon--armed" : ""}`}>
            <Lock className="w-3.5 h-3.5" />
          </div>
          <div className="voice-rec-lock-chevron">
            <span />
            <span />
          </div>
        </div>
      )}

      <div
        className={`voice-rec-panel ${lockedOrPreview ? "voice-rec-panel--locked" : ""}`}
        style={!lockedOrPreview ? { transform: `translateX(${Math.max(slideX, -120)}px)` } : undefined}
      >
        {lockedOrPreview ? (
          <button type="button" className="voice-rec-trash" onClick={onCancel} aria-label="Delete recording">
            <Trash2 className="w-5 h-5" />
          </button>
        ) : (
          <div className="voice-rec-dot-wrap">
            <span className="voice-rec-dot" />
          </div>
        )}

        <div className="voice-rec-main">
          <div className="voice-rec-timer">{formatVoiceDuration(duration)}</div>
          <div className="voice-rec-wave" aria-hidden>
            {(levels.length ? levels : Array.from({ length: 24 }, () => 0.2)).map((level, i) => (
              <span
                key={i}
                className="voice-rec-bar-item"
                style={{ height: `${6 + Math.max(0.08, level) * 18}px` }}
              />
            ))}
          </div>
        </div>

        {!lockedOrPreview && (
          <div className="voice-rec-slide-hint" style={{ opacity: Math.max(0.35, 1 - cancelProgress) }}>
            <ChevronLeft className="w-4 h-4 voice-rec-slide-arrow" />
            <span>Slide to cancel</span>
          </div>
        )}

        {lockedOrPreview && (
          <div className="voice-rec-locked-actions">
            {isLocked && !previewUrl && (
              <button type="button" className="voice-rec-stop" onClick={onStopToPreview} aria-label="Stop recording">
                <Square className="w-3.5 h-3.5" fill="currentColor" />
              </button>
            )}
            <button type="button" className="voice-rec-send" onClick={onSend} aria-label="Send voice message">
              <Send className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(VoiceRecorderBar);
