import { memo, useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { axiosInstance } from "../../lib/axios";
import "./DeleteMessageSheet.css";

/**
 * WhatsApp-style delete confirmation sheet.
 * Fetches canDeleteForEveryone from the backend (source of truth).
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
  const [acting, setActing] = useState(null); // "everyone" | "me"
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
          // Safe fallback: only Delete for Me
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
    <div className="delete-sheet-root" role="dialog" aria-modal="true" aria-labelledby="delete-sheet-title">
      <button type="button" className="delete-sheet-backdrop" aria-label="Close" onClick={acting ? undefined : onClose} />
      <div className="delete-sheet-panel">
        <div className="delete-sheet-handle" />
        <h3 id="delete-sheet-title" className="delete-sheet-title">
          Delete message?
        </h3>

        {loading && (
          <div className="delete-sheet-loading">
            <Loader2 className="w-5 h-5 animate-spin opacity-60" />
          </div>
        )}

        {error && !loading && <p className="delete-sheet-error">{error}</p>}

        {!loading && options && (
          <div className="delete-sheet-actions">
            {options.canDeleteForEveryone && (
              <button
                type="button"
                className="delete-sheet-btn delete-sheet-btn--danger"
                disabled={!!acting}
                onClick={runEveryone}
              >
                {acting === "everyone" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Delete for Everyone
              </button>
            )}
            {options.canDeleteForMe && (
              <button
                type="button"
                className="delete-sheet-btn delete-sheet-btn--muted"
                disabled={!!acting}
                onClick={runMe}
              >
                {acting === "me" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Delete for Me
              </button>
            )}
            <button
              type="button"
              className="delete-sheet-btn delete-sheet-btn--cancel"
              disabled={!!acting}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(DeleteMessageSheet);
