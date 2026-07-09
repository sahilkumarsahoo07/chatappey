import { useCallback, useEffect, useState } from "react";
import { Bell, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import {
  getNotificationPermission,
  requestNotificationPermission,
} from "../lib/notifications";

/** Re-check permission after browser prompt or settings change */
const PERM_EVENT = "notification-permission-change";

export function notifyPermissionChange() {
  window.dispatchEvent(new Event(PERM_EVENT));
}

export default function NotificationPermissionBanner() {
  const [permission, setPermission] = useState(() => getNotificationPermission());
  const [enabling, setEnabling] = useState(false);

  const refreshPermission = useCallback(() => {
    setPermission(getNotificationPermission());
  }, []);

  useEffect(() => {
    refreshPermission();
    window.addEventListener(PERM_EVENT, refreshPermission);
    document.addEventListener("visibilitychange", refreshPermission);
    return () => {
      window.removeEventListener(PERM_EVENT, refreshPermission);
      document.removeEventListener("visibilitychange", refreshPermission);
    };
  }, [refreshPermission]);

  const enable = async () => {
    setEnabling(true);
    try {
      const granted = await requestNotificationPermission({ showTest: true });
      refreshPermission();
      notifyPermissionChange();
      if (granted) {
        toast.success("Notifications are on");
      } else if (getNotificationPermission() === "denied") {
        toast.error(
          "Allow notifications in browser settings (lock icon → Notifications → Allow), then tap Retry.",
          { duration: 8000 }
        );
      }
    } finally {
      setEnabling(false);
    }
  };

  // Notifications on — no gate
  if (permission === "granted" || permission === "unsupported") {
    return null;
  }

  const denied = permission === "denied";

  return (
    <div
      className="fixed inset-0 z-[200000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-gate-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-base-100 border border-base-300 shadow-2xl p-6 md:p-8 text-center">
        <div
          className={`w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center ${
            denied ? "bg-error/15 text-error" : "bg-primary/15 text-primary"
          }`}
        >
          {denied ? (
            <ShieldAlert className="w-8 h-8" />
          ) : (
            <Bell className="w-8 h-8" />
          )}
        </div>

        <h2 id="notification-gate-title" className="text-xl font-bold text-base-content mb-2">
          {denied ? "Notifications are blocked" : "Turn on notifications"}
        </h2>

        <p className="text-sm text-base-content/65 leading-relaxed mb-6">
          {denied ? (
            <>
              ChatAppey needs notifications so you don&apos;t miss messages.
              <br />
              <span className="font-medium text-base-content/80">
                Click the lock icon in your address bar → Notifications → Allow
              </span>
              , then tap Retry below.
            </>
          ) : (
            <>
              Notifications are required for ChatAppey. Tap the button below — your browser will ask once to allow alerts.
            </>
          )}
        </p>

        <button
          type="button"
          onClick={enable}
          disabled={enabling}
          className="btn btn-primary btn-lg w-full rounded-2xl font-bold shadow-lg shadow-primary/25"
        >
          {enabling
            ? "Please wait…"
            : denied
              ? "Retry notifications"
              : "Turn on notifications"}
        </button>

        {denied && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn btn-ghost btn-sm mt-3 text-base-content/50"
          >
            I allowed it — refresh page
          </button>
        )}
      </div>
    </div>
  );
}
