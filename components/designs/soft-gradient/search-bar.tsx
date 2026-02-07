"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  Command,
  Cpu,
  Database,
  File,
  FileSearch,
  FileText,
  Globe,
  History,
  Loader2,
  Mail,
  MessageSquare,
  Radar,
  Repeat2,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useAction, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

const SEARCH_HISTORY_KEY = "mission-control:search-history:v1";
const MAX_HISTORY = 8;

type GroupKey = "activities" | "tasks" | "documents";

type ActivityResult = {
  id: string;
  source: "activities";
  subtype: string;
  title: string;
  snippet: string;
  timestamp: number | null;
  relevance: number;
  status: string;
};

type TaskResult = {
  id: string;
  source: "scheduledTasks";
  subtype: string;
  title: string;
  snippet: string;
  timestamp: number | null;
  relevance: number;
  schedule: string;
  enabled: boolean;
};

type DocumentResult = {
  id: string;
  source: "documents";
  subtype: string;
  title: string;
  snippet: string;
  timestamp: number | null;
  relevance: number;
  path: string;
};

type UnifiedSearchResponse = {
  query: string;
  total: number;
  generatedAt: number;
  activities: ActivityResult[];
  tasks: TaskResult[];
  documents: DocumentResult[];
};

type SearchResult = ActivityResult | TaskResult | DocumentResult;
type NavigableItem = { group: GroupKey; item: SearchResult };
type SearchBarProps = { widget?: boolean; className?: string };

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const pattern = new RegExp(`(${escapeRegExp(query)})`, "ig");
  const segments = text.split(pattern);
  return segments.map((segment, index) => {
    if (segment.toLowerCase() === query.toLowerCase()) {
      return (
        <mark key={`${segment}-${index}`} className="rounded bg-violet-500/30 px-0.5 text-violet-200">
          {segment}
        </mark>
      );
    }
    return <Fragment key={`${segment}-${index}`}>{segment}</Fragment>;
  });
}

function formatTimestamp(ts: number | null) {
  if (!ts) return "Unknown";
  return new Date(ts).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function makeResultKey(group: GroupKey, item: SearchResult) {
  return `${group}:${item.id}`;
}

function getActivityTypeIcon(type: string): LucideIcon {
  const icons: Record<string, LucideIcon> = {
    email: Mail, code: Code2, cron: Clock3, search: Search,
    message: MessageSquare, file: File, browser: Globe,
  };
  return icons[type] ?? Cpu;
}

function getTaskTypeIcon(type: string): LucideIcon {
  return type === "cron" ? Clock3 : type === "reminder" ? Bell : Repeat2;
}

function getDocumentTypeIcon(type: string): LucideIcon {
  const icons: Record<string, LucideIcon> = { memory: Database, config: Settings2, skill: BookOpen };
  return icons[type] ?? FileText;
}

function renderResultIcon(item: SearchResult, className: string): ReactNode {
  if (item.source === "activities") return <>{getActivityTypeIcon(item.subtype)({ className })}</>;
  if (item.source === "scheduledTasks") return <>{getTaskTypeIcon(item.subtype)({ className })}</>;
  return <>{getDocumentTypeIcon(item.subtype)({ className })}</>;
}

export function SearchBar({ widget = false, className }: SearchBarProps) {
  const runUnifiedSearch = useAction(api.search.unifiedSearch);
  const recentActivities = useQuery(api.activities.list, { limit: widget ? 4 : 6 });

  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [history, setHistory] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((e): e is string => typeof e === "string").slice(0, MAX_HISTORY);
    } catch { return []; }
  });
  const [results, setResults] = useState<UnifiedSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [isMobileOverlayOpen, setIsMobileOverlayOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<GroupKey, boolean>>({
    activities: false, tasks: false, documents: false,
  });

  const shouldSearch = debouncedQuery.trim().length >= 2;

  const saveHistory = useCallback((term: string) => {
    const normalized = term.trim();
    if (normalized.length < 2) return;
    setHistory((prev) => {
      const next = [normalized, ...prev.filter((e) => e.toLowerCase() !== normalized.toLowerCase())].slice(0, MAX_HISTORY);
      try { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const applySuggestion = useCallback((term: string) => {
    setQuery(term);
    setDebouncedQuery(term);
    setExpandedKey(null);
  }, []);

  const focusSearch = useCallback(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) {
      setIsMobileOverlayOpen(true);
      requestAnimationFrame(() => { mobileInputRef.current?.focus(); mobileInputRef.current?.select(); });
      return;
    }
    desktopInputRef.current?.focus();
    desktopInputRef.current?.select();
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      const timer = window.setTimeout(() => setDebouncedQuery(""), 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setDebouncedQuery(trimmed);
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);

      runUnifiedSearch({ query: trimmed, limitPerType: widget ? 6 : 12 })
        .then((payload) => {
          if (requestId !== requestIdRef.current) return;
          const typedPayload = payload as UnifiedSearchResponse;
          setResults(typedPayload);
          setIsLoading(false);
          setExpandedKey(null);
          setActiveIndex(typedPayload.total > 0 ? 0 : -1);
          saveHistory(trimmed);
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setResults(null);
          setIsLoading(false);
          setError("Search failed. Try again.");
        });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, runUnifiedSearch, saveHistory, widget]);

  const displayResults = shouldSearch ? results : null;
  const displayError = shouldSearch ? error : null;
  const displayIsLoading = shouldSearch ? isLoading : false;

  useEffect(() => {
    const onGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusSearch();
      }
      if (event.key === "Escape" && isMobileOverlayOpen) setIsMobileOverlayOpen(false);
    };
    window.addEventListener("keydown", onGlobalKeyDown);
    return () => window.removeEventListener("keydown", onGlobalKeyDown);
  }, [focusSearch, isMobileOverlayOpen]);

  const flatResults = useMemo(() => {
    const list: NavigableItem[] = [];
    if (!displayResults) return list;
    if (!collapsed.activities) for (const item of displayResults.activities) list.push({ group: "activities", item });
    if (!collapsed.tasks) for (const item of displayResults.tasks) list.push({ group: "tasks", item });
    if (!collapsed.documents) for (const item of displayResults.documents) list.push({ group: "documents", item });
    return list;
  }, [collapsed, displayResults]);

  const resultIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    flatResults.forEach((e, i) => map.set(makeResultKey(e.group, e.item), i));
    return map;
  }, [flatResults]);

  const clampedActiveIndex = useMemo(() => {
    if (flatResults.length === 0) return -1;
    if (activeIndex < 0) return 0;
    return Math.min(activeIndex, flatResults.length - 1);
  }, [activeIndex, flatResults.length]);

  useEffect(() => {
    if (clampedActiveIndex < 0) return;
    document.querySelector<HTMLElement>(`[data-search-index='${clampedActiveIndex}']`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [clampedActiveIndex]);

  const onInputKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (flatResults.length === 0) return;
      setActiveIndex((prev) => (prev < 0 ? 0 : Math.min(prev + 1, flatResults.length - 1)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (flatResults.length === 0) return;
      setActiveIndex((prev) => Math.max(0, prev - 1));
    }
    if (event.key === "Enter" && clampedActiveIndex >= 0 && flatResults.length > 0) {
      event.preventDefault();
      const target = flatResults[clampedActiveIndex];
      const key = makeResultKey(target.group, target.item);
      setExpandedKey((prev) => (prev === key ? null : key));
    }
  }, [clampedActiveIndex, flatResults]);

  const renderResults = () => {
    const isIdle = query.trim().length < 2;
    const total = displayResults?.total ?? 0;

    return (
      <div className="space-y-4">
        {displayIsLoading && (
          <div className="flex items-center gap-2 rounded-2xl bg-violet-500/20 p-4">
            <Loader2 className="size-4 animate-spin text-violet-300" />
            <span className="text-sm text-violet-300">Searching...</span>
          </div>
        )}

        {displayError && (
          <div className="rounded-2xl bg-red-500/20 p-4 text-sm text-red-300">{displayError}</div>
        )}

        {isIdle && (
          <div className="space-y-4">
            {history.length > 0 && (
              <section className="rounded-3xl bg-gradient-to-br from-violet-950/50 to-fuchsia-950/30 p-5">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium text-violet-400">
                  <History className="size-3.5" />
                  Recent searches
                </div>
                <div className="flex flex-wrap gap-2">
                  {history.map((entry) => (
                    <button
                      key={entry}
                      onClick={() => applySuggestion(entry)}
                      className="rounded-full bg-white/5 px-3 py-1.5 text-xs text-violet-300 transition-all hover:bg-white/10"
                    >
                      {entry}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-3xl bg-gradient-to-br from-violet-950/50 to-fuchsia-950/30 p-5">
              <h3 className="text-xs font-medium text-violet-400">Tips</h3>
              <ul className="mt-2 space-y-1 text-xs text-violet-300/70">
                <li>Search by activity name or type</li>
                <li>Use cron patterns like "*/15"</li>
                <li>Search document paths</li>
              </ul>
            </section>

            <section className="rounded-3xl bg-gradient-to-br from-violet-950/50 to-fuchsia-950/30 p-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-medium text-violet-400">
                <Radar className="size-3.5" />
                Recent Activity
              </div>
              <div className="space-y-2">
                {(recentActivities ?? []).slice(0, widget ? 3 : 5).map((a: Doc<"activities">) => (
                  <article key={a._id} className="rounded-xl bg-white/5 p-3">
                    <p className="text-sm text-white">{a.title}</p>
                    <p className="mt-1 text-xs text-violet-400/60">{a.type} · {formatTimestamp(a.timestamp)}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {!displayIsLoading && shouldSearch && displayResults && total === 0 && (
          <div className="rounded-3xl bg-white/5 p-8 text-center">
            <FileSearch className="mx-auto size-10 text-violet-400/50" />
            <p className="mt-3 text-sm text-violet-300/70">No matches found</p>
          </div>
        )}

        {!displayIsLoading && shouldSearch && displayResults && total > 0 && (
          <div className="space-y-4">
            <ResultSection group="activities" title="Activities" icon={Radar} count={displayResults.activities.length} collapsed={collapsed.activities} onToggle={() => setCollapsed((p) => ({ ...p, activities: !p.activities }))} gradient="from-pink-500 to-rose-500">
              {displayResults.activities.map((item) => {
                const key = makeResultKey("activities", item);
                const index = resultIndexMap.get(key) ?? -1;
                return <ResultCard key={key} index={index} query={debouncedQuery} item={item} active={index === clampedActiveIndex} expanded={expandedKey === key} onSelect={() => { setActiveIndex(index); setExpandedKey((p) => (p === key ? null : key)); }} />;
              })}
            </ResultSection>

            <ResultSection group="tasks" title="Scheduled Tasks" icon={Clock3} count={displayResults.tasks.length} collapsed={collapsed.tasks} onToggle={() => setCollapsed((p) => ({ ...p, tasks: !p.tasks }))} gradient="from-violet-500 to-purple-500">
              {displayResults.tasks.map((item) => {
                const key = makeResultKey("tasks", item);
                const index = resultIndexMap.get(key) ?? -1;
                return <ResultCard key={key} index={index} query={debouncedQuery} item={item} active={index === clampedActiveIndex} expanded={expandedKey === key} onSelect={() => { setActiveIndex(index); setExpandedKey((p) => (p === key ? null : key)); }} />;
              })}
            </ResultSection>

            <ResultSection group="documents" title="Documents" icon={FileText} count={displayResults.documents.length} collapsed={collapsed.documents} onToggle={() => setCollapsed((p) => ({ ...p, documents: !p.documents }))} gradient="from-cyan-500 to-blue-500">
              {displayResults.documents.map((item) => {
                const key = makeResultKey("documents", item);
                const index = resultIndexMap.get(key) ?? -1;
                return <ResultCard key={key} index={index} query={debouncedQuery} item={item} active={index === clampedActiveIndex} expanded={expandedKey === key} onSelect={() => { setActiveIndex(index); setExpandedKey((p) => (p === key ? null : key)); }} />;
              })}
            </ResultSection>
          </div>
        )}
      </div>
    );
  };

  const renderPrompt = (inputRef: RefObject<HTMLInputElement | null>, options?: { mobileMode?: boolean; onClose?: () => void }) => {
    const mobileMode = options?.mobileMode ?? false;

    return (
      <div className="space-y-4">
        <section className={cn("rounded-3xl bg-gradient-to-br from-violet-950/50 to-fuchsia-950/30 shadow-xl backdrop-blur-sm", widget ? "p-5" : "p-6")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-violet-400/80">Global Search</p>
              <p className="mt-0.5 text-xs text-violet-300/60">Search everything</p>
            </div>
            {!mobileMode && (
              <span className="flex items-center gap-1 rounded-full bg-violet-500/20 px-2.5 py-1 text-[10px] font-medium text-violet-300">
                <Command className="size-3" /> K
              </span>
            )}
            {mobileMode && options?.onClose && (
              <button onClick={options.onClose} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-violet-300">
                Close
              </button>
            )}
          </div>

          <div className="mt-4 flex items-center rounded-2xl bg-white/5 px-4">
            <Search className="size-4 text-violet-400/60" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Type to search..."
              className="h-12 flex-1 bg-transparent px-3 text-sm text-white placeholder:text-violet-400/50 focus:outline-none"
            />
            <Sparkles className="size-4 animate-pulse text-violet-400/60" />
          </div>

          <div className="mt-2 flex gap-3 text-[10px] text-violet-400/50">
            <span>↑↓ Navigate</span>
            <span>Enter to expand</span>
            <span>{displayResults?.total ?? 0} results</span>
          </div>
        </section>

        {renderResults()}
      </div>
    );
  };

  return (
    <section className={cn("space-y-4", className)}>
      <div className="hidden md:block">{renderPrompt(desktopInputRef)}</div>

      <div className="md:hidden">
        <button
          type="button"
          onClick={() => { setIsMobileOverlayOpen(true); requestAnimationFrame(() => mobileInputRef.current?.focus()); }}
          className="flex w-full items-center justify-between rounded-2xl bg-gradient-to-br from-violet-950/50 to-fuchsia-950/30 px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Search className="size-4 text-violet-400" />
            <span className="text-sm text-violet-300">{query.trim() || "Search..."}</span>
          </div>
          <span className="text-[10px] text-violet-400/60">Tap</span>
        </button>
      </div>

      {isMobileOverlayOpen && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-gradient-to-b from-violet-950 to-fuchsia-950 p-4 pb-24 md:hidden">
          {renderPrompt(mobileInputRef, { mobileMode: true, onClose: () => setIsMobileOverlayOpen(false) })}
        </div>
      )}
    </section>
  );
}

function ResultSection({ group, title, icon: Icon, count, collapsed, onToggle, gradient, children }: {
  group: GroupKey; title: string; icon: LucideIcon; count: number; collapsed: boolean; onToggle: () => void; gradient: string; children: ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-gradient-to-br from-violet-950/50 to-fuchsia-950/30 p-5" data-group={group}>
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 border-b border-white/10 pb-3">
        <span className="flex items-center gap-2">
          <Icon className="size-4 text-violet-300" />
          <span className="text-sm font-medium text-white">{title}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className={cn("rounded-full bg-gradient-to-r px-2 py-0.5 text-[10px] font-medium text-white", gradient)}>{count}</span>
          {collapsed ? <ChevronRight className="size-4 text-violet-400" /> : <ChevronDown className="size-4 text-violet-400" />}
        </span>
      </button>
      {!collapsed && <div className="mt-3 space-y-2">{children}</div>}
    </section>
  );
}

function ResultCard({ item, query, index, active, expanded, onSelect }: {
  item: SearchResult; query: string; index: number; active: boolean; expanded: boolean; onSelect: () => void;
}) {
  const iconElement = renderResultIcon(item, "size-4");

  return (
    <button
      type="button"
      data-search-index={index >= 0 ? index : undefined}
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl p-4 text-left transition-all",
        active ? "bg-violet-500/20 shadow-lg shadow-violet-500/10" : "bg-white/5 hover:bg-white/10"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 rounded-xl bg-violet-500/20 p-2 text-violet-300">{iconElement}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{highlightMatch(item.title, query)}</p>
            <p className="mt-1 line-clamp-2 text-xs text-violet-300/70">{highlightMatch(item.snippet, query)}</p>
          </div>
        </div>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-violet-300">{item.subtype}</span>
      </div>

      <div className="mt-3 flex items-center gap-2 text-[10px] text-violet-400/60">
        <span>{formatTimestamp(item.timestamp)}</span>
        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full bg-gradient-to-r from-violet-400 to-fuchsia-400" style={{ width: `${Math.round(item.relevance * 100)}%` }} />
        </span>
      </div>

      {expanded && (
        <div className="mt-3 rounded-xl bg-black/20 p-3 text-xs text-violet-300/80">
          {item.source === "activities" && <p>Status: {item.status}</p>}
          {item.source === "scheduledTasks" && <><p>Schedule: {item.schedule}</p><p>Enabled: {item.enabled ? "Yes" : "No"}</p></>}
          {item.source === "documents" && <p>Path: {item.path}</p>}
        </div>
      )}
    </button>
  );
}
