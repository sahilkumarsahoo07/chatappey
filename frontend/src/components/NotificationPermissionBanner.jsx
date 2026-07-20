import { useCallback, useEffect, useState } from "react";
import { Bell, ShieldAlert, Share, Smartphone, Home } from "lucide-react";
import toast from "react-hot-toast";
import {
  getNotificationPermission,
  requestNotificationPermission,
  isIOSDevice,
  isAndroidDevice,
  isStandalonePWA,
  canReceiveBackgroundPush,
  subscribeToWebPush,
} from "../lib/notifications";

/** Re-check permission after browser prompt or settings change */
const PERM_EVENT = "notification-permission-change";

export function notifyPermissionChange() {
  window.dispatchEvent(new Event(PERM_EVENT));
}

export default function NotificationPermissionBanner() {
  const [permission, setPermission] = useState(() => getNotificationPermission());
  const [enabling, setEnabling] = useState(false);
  const [standalone, setStandalone] = useState(() => isStandalonePWA());

  const iosNeedsInstall = isIOSDevice() && !standalone;
  const pushReady = canReceiveBackgroundPush();

  const refreshPermission = useCallback(() => {
    setPermission(getNotificationPermission());
    setStandalone(isStandalonePWA());
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

  // Already subscribed path: keep push registration fresh when granted + capable
  useEffect(() => {
    if (permission === "granted" && pushReady) {
      subscribeToWebPush().catch(() => {});
    }
  }, [permission, pushReady]);

  const enable = async () => {
    if (iosNeedsInstall) {
      toast.error("First add ChatAppey to your Home Screen, then open it from there.", {
        duration: 6000,
      });
      return;
    }

    setEnabling(true);
    try {
      const granted = await requestNotificationPermission({ showTest: true });
      refreshPermission();
      notifyPermissionChange();
      if (granted) {
        toast.success("Notifications are on — you'll get alerts like WhatsApp");
      } else if (getNotificationPermission() === "denied") {
        toast.error(
          isAndroidDevice()
            ? "Allow notifications: Chrome menu (⋮) → Settings → Site settings → Notifications → Allow"
            : "Allow notifications in browser settings, then tap Retry.",
          { duration: 9000 }
        );
      } else {
        toast.error("Could not enable push notifications. Try again.");
      }
    } finally {
      setEnabling(false);
    }
  };

  // Notifications on and push capable — no gate
  if (permission === "granted" && (pushReady || !isIOSDevice())) {
    return null;
  }
  if (permission === "unsupported") {
    return null;
  }

  // iOS Safari tab: must install first (permission alone is not enough)
  if (iosNeedsInstall) {
    return (
      <div
        className="fixed inset-0 z-[200000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-gate-title"
      >
        <div className="w-full max-w-md rounded-3xl bg-base-100 border border-base-300 shadow-2xl p-6 md:p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center bg-primary/15 text-primary">
            <Smartphone className="w-8 h-8" />
          </div>

          <h2 id="notification-gate-title" className="text-xl font-bold text-base-content mb-2">
            Install ChatAppey for notifications
          </h2>

          <p className="text-sm text-base-content/65 leading-relaxed mb-4">
            On iPhone/iPad, message alerts only work after you add ChatAppey to your Home Screen
            (same idea as WhatsApp — the app must be installed).
          </p>

          <ol className="text-left text-sm text-base-content/80 space-y-3 mb-6 bg-base-200/60 rounded-2xl p-4 border border-base-300">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-content flex items-center justify-center text-xs font-bold">1</span>
              <span>
                Tap <Share className="inline w-4 h-4 -mt-0.5" /> <strong>Share</strong> in Safari
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-content flex items-center justify-center text-xs font-bold">2</span>
              <span>
                Tap <Home className="inline w-4 h-4 -mt-0.5" /> <strong>Add to Home Screen</strong>
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-content flex items-center justify-center text-xs font-bold">3</span>
              <span>
                Open <strong>ChatAppey</strong> from your Home Screen, then turn on notifications
              </span>
            </li>
          </ol>

          <button
            type="button"
            onClick={() => {
              refreshPermission();
              if (isStandalonePWA()) {
                toast.success("Installed! Now tap Turn on notifications");
              } else {
                toast("Open ChatAppey from your Home Screen icon", { icon: "📱", duration: 5000 });
              }
            }}
            className="btn btn-primary btn-lg w-full rounded-2xl font-bold shadow-lg shadow-primary/25"
          >
            I installed it — continue
          </button>
        </div>
      </div>
    );
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
            isAndroidDevice() ? (
              <>
                ChatAppey needs alerts so you don&apos;t miss messages.
                <br />
                <span className="font-medium text-base-content/80">
                  Chrome ⋮ → Settings → Site settings → Notifications → Allow
                </span>
                , then tap Retry.
              </>
            ) : (
              <>
                Allow notifications in browser settings, then tap Retry.
              </>
            )
          ) : (
            <>
              Get instant message alerts like WhatsApp — even when ChatAppey is closed or your phone is locked.
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
