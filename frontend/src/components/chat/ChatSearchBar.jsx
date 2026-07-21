import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightText(text, query, isActive = false) {
  if (!text || !query?.trim()) return text;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark
        key={i}
        className={
          isActive
            ? "bg-amber-400/90 text-base-content rounded-[3px] px-0.5 font-medium"
            : "bg-amber-300/55 text-inherit rounded-[3px] px-0.5"
        }
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function parseMessageText(text, query, isActive = false) {
  if (!text) return text;

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-info hover:underline break-all underline-offset-2"
          onClick={(e) => e.stopPropagation()}
        >
          {query ? highlightText(part, query, isActive) : part}
        </a>
      );
    }
    return query ? highlightText(part, query, isActive) : part;
  });
}

const ChatSearchBar = memo(function ChatSearchBar({
  messages,
  onActiveMatchChange,
  onSearchQueryChange,
  containerRef,
  open,
  onOpenChange,
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 280);
    return () => clearTimeout(t);
  }, [query]);

  const matchIds = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    if (!q) return [];
    return messages
      .filter((m) => m.text && m.text.toLowerCase().includes(q))
      .map((m) => m._id);
  }, [messages, debouncedQuery]);

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery]);

  useEffect(() => {
    onSearchQueryChange?.(debouncedQuery);
  }, [debouncedQuery, onSearchQueryChange]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      onActiveMatchChange?.(null);
      onSearchQueryChange?.("");
    }
  }, [open, onActiveMatchChange, onSearchQueryChange]);

  useEffect(() => {
    if (!open || !debouncedQuery || matchIds.length === 0) {
      if (!matchIds.length) onActiveMatchChange?.(null);
      return;
    }
    const id = matchIds[activeIndex];
    onActiveMatchChange?.(id);
    const el = containerRef?.current?.querySelector(`[data-message-id="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex, matchIds, debouncedQuery, onActiveMatchChange, containerRef, open]);

  const goPrev = useCallback(() => {
    if (!matchIds.length) return;
    setActiveIndex((i) => (i - 1 + matchIds.length) % matchIds.length);
  }, [matchIds.length]);

  const goNext = useCallback(() => {
    if (!matchIds.length) return;
    setActiveIndex((i) => (i + 1) % matchIds.length);
  }, [matchIds.length]);

  const close = useCallback(() => {
    onOpenChange?.(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) goPrev();
        else goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, goNext, goPrev]);

  if (!open) return null;

  const resultLabel = !debouncedQuery
    ? null
    : matchIds.length === 0
      ? "No matches"
      : `${activeIndex + 1} of ${matchIds.length}`;

  return (
    <div className="chat-search-panel animate-[chatSearchIn_0.2s_ease-out]">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={close}
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base-content/70 hover:bg-base-200 active:scale-95 transition-all"
          aria-label="Close search"
        >
          <X size={20} strokeWidth={2} />
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-2 h-10 px-3 rounded-full bg-base-200/90 border border-base-300/40 focus-within:border-primary/35 focus-within:ring-2 focus-within:ring-primary/15 transition-all">
          <Search size={16} className="shrink-0 text-base-content/40" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages"
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] placeholder:text-base-content/40"
            enterKeyHint="search"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="shrink-0 w-5 h-5 rounded-full bg-base-content/15 text-base-content/60 flex items-center justify-center hover:bg-base-content/25"
              aria-label="Clear"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={goPrev}
            disabled={!matchIds.length}
            className="w-9 h-9 rounded-full flex items-center justify-center text-base-content/65 hover:bg-base-200 disabled:opacity-25 disabled:pointer-events-none active:scale-95 transition-all"
            title="Previous"
          >
            <ChevronUp size={18} strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!matchIds.length}
            className="w-9 h-9 rounded-full flex items-center justify-center text-base-content/65 hover:bg-base-200 disabled:opacity-25 disabled:pointer-events-none active:scale-95 transition-all"
            title="Next"
          >
            <ChevronDown size={18} strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {resultLabel && (
        <div className="px-4 pb-2.5 -mt-0.5 flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
              matchIds.length
                ? "bg-primary/12 text-primary"
                : "bg-error/10 text-error"
            }`}
          >
            {resultLabel}
          </span>
          {matchIds.length > 0 && (
            <span className="text-[11px] text-base-content/45">
              {matchIds.length === 1 ? "1 message found" : `${matchIds.length} messages found`}
            </span>
          )}
        </div>
      )}

      <style>{`
        @keyframes chatSearchIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
});

export default ChatSearchBar;
