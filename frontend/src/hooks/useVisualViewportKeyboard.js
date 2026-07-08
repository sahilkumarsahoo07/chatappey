import { useEffect, useState } from "react";

/**
 * Tracks the soft keyboard via the Visual Viewport API (WhatsApp-like).
 * Sets --keyboard-inset on <html> and toggles .keyboard-open on <html>/<body>.
 * With viewport interactive-widget=overlays-content, the layout does not jump —
 * consumers pad/translate the composer instead.
 */
export function useVisualViewportKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const vv = window.visualViewport;
    let raf = 0;

    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const layoutH = window.innerHeight;
        let inset = 0;

        if (vv) {
          // Distance from bottom of layout viewport to bottom of visual viewport
          inset = Math.max(0, layoutH - vv.height - vv.offsetTop);
        }

        // Ignore tiny browser chrome jitter
        if (inset < 80) inset = 0;

        setKeyboardHeight((prev) => (prev === inset ? prev : inset));

        const root = document.documentElement;
        root.style.setProperty("--keyboard-inset", `${inset}px`);
        root.classList.toggle("keyboard-open", inset > 0);
        document.body.classList.toggle("keyboard-open", inset > 0);
      });
    };

    measure();

    if (vv) {
      vv.addEventListener("resize", measure);
      vv.addEventListener("scroll", measure);
    }
    window.addEventListener("resize", measure);
    // iOS often fires focus without an immediate vv resize
    window.addEventListener("focusin", measure);
    window.addEventListener("focusout", measure);

    return () => {
      cancelAnimationFrame(raf);
      if (vv) {
        vv.removeEventListener("resize", measure);
        vv.removeEventListener("scroll", measure);
      }
      window.removeEventListener("resize", measure);
      window.removeEventListener("focusin", measure);
      window.removeEventListener("focusout", measure);
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
