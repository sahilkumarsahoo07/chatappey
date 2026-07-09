import { useEffect } from "react";

/**
 * Tracks composer height + scrolls messages when keyboard opens (CSS vars only).
 */
export function useComposerLayout() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let ro = null;
    let observed = null;

    const measureComposer = () => {
      const el = document.querySelector(".message-input-container");
      if (!el) return;
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--composer-height", `${h}px`);
    };

    const attachObserver = () => {
      const el = document.querySelector(".message-input-container");
      if (!el || el === observed) return;
      observed = el;
      ro?.disconnect();
      ro = new ResizeObserver(() => measureComposer());
      ro.observe(el);
      measureComposer();
    };

    attachObserver();

    const mo = new MutationObserver(() => attachObserver());
    mo.observe(document.body, { childList: true, subtree: true });

    const onInsetChange = () => {
      measureComposer();
      if (!document.documentElement.classList.contains("keyboard-open")) return;
      const focused = document.activeElement?.closest?.(".message-input-container");
      if (!focused) return;
      const container = document.querySelector(".messages-container");
      if (!container) return;
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    };

    window.addEventListener("keyboard-inset-change", onInsetChange);
    window.addEventListener("resize", measureComposer);

    return () => {
      ro?.disconnect();
      mo.disconnect();
      window.removeEventListener("keyboard-inset-change", onInsetChange);
      window.removeEventListener("resize", measureComposer);
      document.documentElement.style.setProperty("--composer-height", "76px");
    };
  }, []);
}
