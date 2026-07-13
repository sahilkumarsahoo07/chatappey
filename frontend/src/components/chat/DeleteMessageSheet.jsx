import { memo, useCallback, useEffect, useState } from "react";
import { ChevronRight, Loader2, Trash2, UserRoundX, UsersRound, X } from "lucide-react";
import { axiosInstance } from "../../lib/axios";
import "./DeleteMessageSheet.css";

/**
 * Modern bottom-sheet delete dialog with icon option rows.
 */
function DeleteMessageSheet({
  open,
  messageId,
  /** "dm" | "group" */
  mode = "dm",
  groupId = null,
  onClose,
  onDeleteForEveryone,
  onDeleteForMe,
}) {
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(null);
  const [options, setOptions] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !messageId) {
      setOptions(null);
      setError(null);
      setActing(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const url =
      mode === "group" && groupId
        ? `/groups/${groupId}/messages/${messageId}/delete-options`
        : `/messages/${messageId}/delete-options`;

    axiosInstance
      .get(url)
      .then((res) => {
        if (!cancelled) setOptions(res.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.response?.data?.error || "Could not load delete options");
          setOptions({
            canDeleteForMe: true,
            canDeleteForEveryone: false,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, messageId, mode, groupId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !acting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, acting, onClose]);

  const runEveryone = useCallback(async () => {
    if (!onDeleteForEveryone || acting) return;
    setActing("everyone");
    try {
      await onDeleteForEveryone(messageId);
      onClose();
    } catch {
      setActing(null);
    }
  }, [onDeleteForEveryone, messageId, acting, onClose]);

  const runMe = useCallback(async () => {
    if (!onDeleteForMe || acting) return;
    setActing("me");
    try {
      await onDeleteForMe(messageId);
      onClose();
    } catch {
      setActing(null);
    }
  }, [onDeleteForMe, messageId, acting, onClose]);

  if (!open) return null;

  return (
    <div
      className="delete-sheet-root"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-sheet-title"
      aria-describedby="delete-sheet-subtitle"
    >
      <button
        type="button"
        className="delete-sheet-backdrop"
        aria-label="Close"
        onClick={acting ? undefined : onClose}
      />

      <div className="delete-sheet-panel bg-base-100 text-base-content border border-base-300/60">
        <div className="delete-sheet-handle bg-base-content" />

        <div className="delete-sheet-header">
          <div className="delete-sheet-header-text">
            <h3 id="delete-sheet-title" className="delete-sheet-title">
              Delete message
            </h3>
            <p id="delete-sheet-subtitle" className="delete-sheet-subtitle">
              {loading
                ? "Loading options…"
                : "This action can’t be undone for the selected option."}
            </p>
          </div>
          <button
            type="button"
            className="delete-sheet-close bg-base-200 text-base-content"
            aria-label="Close"
            disabled={!!acting}
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading && (
          <div className="delete-sheet-loading">
            <Loader2 className="w-5 h-5 animate-spin text-base-content/45" />
          </div>
        )}

        {error && !loading && (
          <p className="delete-sheet-error text-error">{error}</p>
        )}

        {!loading && options && (
          <>
            <div className="delete-sheet-options">
              {options.canDeleteForEveryone && (
                <button
                  type="button"
                  className="delete-sheet-option delete-sheet-option--danger bg-error/10 text-error"
                  disabled={!!acting}
                  onClick={runEveryone}
                >
                  <span className="delete-sheet-option-icon bg-error/15">
                    {acting === "everyone" ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <UsersRound className="w-5 h-5" />
                    )}
                  </span>
                  <span className="delete-sheet-option-copy">
                    <span className="delete-sheet-option-title">Delete for everyone</span>
                    <span className="delete-sheet-option-desc">
                      Remove this message for you and the other person
                    </span>
                  </span>
                  <ChevronRight className="delete-sheet-option-chevron w-4 h-4" />
                </button>
              )}

              {options.canDeleteForMe && (
                <button
                  type="button"
                  className="delete-sheet-option delete-sheet-option--neutral bg-base-200 text-base-content"
                  disabled={!!acting}
                  onClick={runMe}
                >
                  <span className="delete-sheet-option-icon bg-base-300/70">
                    {acting === "me" ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <UserRoundX className="w-5 h-5 opacity-80" />
                    )}
                  </span>
                  <span className="delete-sheet-option-copy">
                    <span className="delete-sheet-option-title">Delete for me</span>
                    <span className="delete-sheet-option-desc">
                      Only remove it from your chat history
                    </span>
                  </span>
                  <ChevronRight className="delete-sheet-option-chevron w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="button"
              className="delete-sheet-cancel bg-base-200 text-base-content/80"
              disabled={!!acting}
              onClick={onClose}
            >
              Cancel
            </button>
          </>
        )}

        {!loading && !options && (
          <div className="delete-sheet-loading">
            <Trash2 className="w-5 h-5 text-base-content/35" />
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(DeleteMessageSheet);
