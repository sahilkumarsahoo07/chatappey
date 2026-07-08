import { useEffect, useState } from "react";

const KEYBOARD_THRESHOLD = 48;

/**
 * Tracks the soft keyboard via the Visual Viewport API (WhatsApp-like).
 * Sets --keyboard-inset on <html> and toggles .keyboard-open on <html>/<body>.
 */
export function useVisualViewportKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const vv = window.visualViewport;
    let raf = 0;
    let focusTimer = null;

    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const layoutH = window.innerHeight;
        let inset = 0;

        if (vv) {
          inset = Math.max(0, layoutH - vv.height - vv.offsetTop);
        }

        const focusedInComposer = document.activeElement?.closest?.(
          ".message-input-container"
        );

        // Android fallback when overlay mode reports a small inset while typing
        if (focusedInComposer && vv && inset < KEYBOARD_THRESHOLD) {
          const heightGap = layoutH - vv.height;
          if (heightGap > KEYBOARD_THRESHOLD) {
            inset = Math.max(inset, heightGap - vv.offsetTop);
          }
        }

        if (inset < KEYBOARD_THRESHOLD) inset = 0;

        setKeyboardHeight((prev) => (prev === inset ? prev : inset));

        const root = document.documentElement;
        root.style.setProperty("--keyboard-inset", `${inset}px`);
        root.classList.toggle("keyboard-open", inset > 0);
        document.body.classList.toggle("keyboard-open", inset > 0);
      });
    };

    const scheduleMeasure = (delays = [0, 80, 180, 320]) => {
      measure();
      delays.forEach((ms) => {
        setTimeout(measure, ms);
      });
    };

    const onFocusIn = (e) => {
      if (!e.target.closest?.(".message-input-container")) return;
      scheduleMeasure();
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        e.target.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
        measure();
      }, 280);
    };

    const onFocusOut = () => {
      clearTimeout(focusTimer);
      setTimeout(measure, 120);
    };

    measure();

    if (vv) {
      vv.addEventListener("resize", measure);
      vv.addEventListener("scroll", measure);
    }
    window.addEventListener("resize", measure);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(focusTimer);
      if (vv) {
        vv.removeEventListener("resize", measure);
        vv.removeEventListener("scroll", measure);
      }
      window.removeEventListener("resize", measure);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
      document.documentElement.style.setProperty("--keyboard-inset", "0px");
      document.documentElement.classList.remove("keyboard-open");
      document.body.classList.remove("keyboard-open");
    };
  }, []);

  return {
    keyboardHeight,
    isKeyboardOpen: keyboardHeight > 0,
  };
}
