import React, { useState, useEffect } from "react";
import { Bell, BellRing, X, CheckCircle2, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import {
  shouldShowNotificationPrompt,
  dismissNotificationPromptLater,
  requestNotificationPermission,
  refreshNotificationPermissionUI,
  isIOSDevice,
  isStandalonePWA,
} from "../lib/notifications";

export const NotificationPromptModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const checkEligibility = () => {
    if (shouldShowNotificationPrompt()) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    checkEligibility();

    // Check every 15 seconds so if 30 minutes elapse, it triggers promptly
    const interval = setInterval(() => {
      checkEligibility();
    }, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkEligibility();
      }
    };

    window.addEventListener("notification-permission-change", checkEligibility);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("notification-permission-change", checkEligibility);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (!isOpen) return null;

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestNotificationPermission({ showTest: true });
      if (granted) {
        toast.success("Notifications enabled successfully!");
        setIsOpen(false);
      } else {
        if ("Notification" in window && Notification.permission === "denied") {
          toast.error("Notification permission blocked in browser settings.");
        }
        dismissNotificationPromptLater();
        setIsOpen(false);
      }
    } catch (err) {
      console.error("Error requesting notification permission:", err);
      dismissNotificationPromptLater();
      setIsOpen(false);
    } finally {
      setIsRequesting(false);
      refreshNotificationPermissionUI();
    }
  };

  const handleLater = () => {
    dismissNotificationPromptLater();
    setIsOpen(false);
    toast("We'll remind you in 30 minutes", {
      icon: "⏰",
    });
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-base-100 p-6 shadow-2xl border border-base-300 transition-all transform scale-100">
        {/* Top decorative gradient glow */}
        <div className="absolute -top-12 -right-12 size-32 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 size-32 rounded-full bg-secondary/20 blur-2xl pointer-events-none" />

        <button
          onClick={handleLater}
          className="absolute top-4 right-4 p-1.5 text-base-content/60 hover:text-base-content hover:bg-base-200 rounded-full transition-colors"
          title="Close"
        >
          <X className="size-5" />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          {/* Animated Icon Badge */}
          <div className="relative flex items-center justify-center size-16 rounded-2xl bg-gradient-to-tr from-primary/20 to-secondary/20 text-primary border border-primary/30 shadow-inner">
            <BellRing className="size-8 animate-bounce text-primary" />
            <span className="absolute -top-1 -right-1 flex size-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full size-3 bg-primary"></span>
            </span>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xl font-bold text-base-content tracking-tight">
              Turn On Notifications
            </h3>
            <p className="text-sm text-base-content/70 leading-relaxed px-2">
              Stay connected like WhatsApp! Get instant alerts for incoming messages and quick replies even when ChatAppey is in the background.
            </p>
          </div>

          {isIOSDevice() && !isStandalonePWA() && (
            <div className="w-full text-left p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-base-content/80 space-y-1">
              <p className="font-semibold text-primary flex items-center gap-1">
                <span>📱 iPhone Notification Note:</span>
              </p>
              <p>
                Safari on iOS requires adding ChatAppey to your Home Screen:
                <br />
                1. Tap the <span className="font-bold">Share ↗️</span> button in Safari
                <br />
                2. Select <span className="font-bold">"Add to Home Screen"</span>
              </p>
            </div>
          )}

          <div className="w-full flex flex-col gap-2.5 pt-2">
            <button
              onClick={handleEnable}
              disabled={isRequesting}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary to-secondary text-primary-content font-semibold text-sm shadow-lg shadow-primary/25 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {isRequesting ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Bell className="size-4" />
              )}
              Enable Notifications
            </button>

            <button
              onClick={handleLater}
              disabled={isRequesting}
              className="w-full py-2.5 px-4 rounded-xl bg-base-200 hover:bg-base-300 text-base-content font-medium text-sm transition-all"
            >
              Later
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-base-content/50 pt-1">
            <ShieldCheck className="size-3.5 text-success" />
            <span>You can change notification permissions anytime in settings</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPromptModal;
