import { useEffect, useRef } from "react";

const KEYBOARD_THRESHOLD = 48;
const INSET_EPSILON = 4;

/**
 * Tracks soft keyboard via Visual Viewport — CSS vars only (no React re-renders).
 */
export function useVisualViewportKeyboard() {
  const insetRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const vv = window.visualViewport;
    let raf = 0;
    let debounce = 0;

    const applyInset = (inset) => {
      const root = document.documentElement;
      if (vv) {
        root.style.setProperty("--visual-viewport-height", `${Math.round(vv.height)}px`);
        root.style.setProperty("--visual-viewport-offset-top", `${Math.round(vv.offsetTop)}px`);
      }

      const next = inset < KEYBOARD_THRESHOLD ? 0 : Math.round(inset);
      if (Math.abs(next - insetRef.current) < INSET_EPSILON) return;
      insetRef.current = next;

      root.style.setProperty("--keyboard-inset", `${next}px`);

      const open = next > 0;
      root.classList.toggle("keyboard-open", open);
      document.body.classList.toggle("keyboard-open", open);
      window.dispatchEvent(
        new CustomEvent("keyboard-inset-change", { detail: { inset: next, open } })
      );
    };

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

        if (focusedInComposer && vv) {
          const heightGap = layoutH - vv.height;
          if (heightGap > KEYBOARD_THRESHOLD) {
            inset = Math.max(inset, heightGap - vv.offsetTop);
          }
        }

        applyInset(inset);
      });
    };

    const scheduleMeasure = () => {
      clearTimeout(debounce);
      debounce = setTimeout(measure, 16);
    };

    const onFocusIn = (e) => {
      if (!e.target.closest?.(".message-input-container")) return;
      measure();
      setTimeout(measure, 100);
      setTimeout(measure, 280);
    };

    measure();

    if (vv) {
      vv.addEventListener("resize", scheduleMeasure);
      vv.addEventListener("scroll", scheduleMeasure);
    }
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", scheduleMeasure);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(debounce);
      if (vv) {
        vv.removeEventListener("resize", scheduleMeasure);
        vv.removeEventListener("scroll", scheduleMeasure);
      }
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", scheduleMeasure);
      insetRef.current = 0;
      document.documentElement.style.setProperty("--keyboard-inset", "0px");
      document.documentElement.style.removeProperty("--visual-viewport-height");
      document.documentElement.style.removeProperty("--visual-viewport-offset-top");
      document.documentElement.classList.remove("keyboard-open");
      document.body.classList.remove("keyboard-open");
    };
  }, []);
}
