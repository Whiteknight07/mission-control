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
  TerminalSquare,
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
        <mark key={`${segment}-${index}`} className="bg-[#ff00ff] px-0.5 text-black">
          {segment}
        </mark>
      );
    }
    return <Fragment key={`${segment}-${index}`}>{segment}</Fragment>;
  });
}

function formatTimestamp(timestamp: number | null) {
  if (!timestamp) return "UNKNOWN";
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const icons: Record<string, LucideIcon> = { cron: Clock3, reminder: Bell };
  return icons[type] ?? Repeat2;
}

function getDocumentTypeIcon(type: string): LucideIcon {
  const icons: Record<string, LucideIcon> = { memory: Database, config: Settings2, skill: BookOpen };
  return icons[type] ?? FileText;
}

function renderResultIcon(item: SearchResult, className: string): ReactNode {
  if (item.source === "activities") {
    const Icon = getActivityTypeIcon(item.subtype);
    return <Icon className={className} />;
  }
  if (item.source === "scheduledTasks") {
    const Icon = getTaskTypeIcon(item.subtype);
    return <Icon className={className} />;
  }
  const Icon = getDocumentTypeIcon(item.subtype);
  return <Icon className={className} />;
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
    } catch {
      return [];
    }
  });
  const [results, setResults] = useState<UnifiedSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [isMobileOverlayOpen, setIsMobileOverlayOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<GroupKey, boolean>>({
    activities: false,
    tasks: false,
    documents: false,
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
      requestAnimationFrame(() => {
        mobileInputRef.current?.focus();
        mobileInputRef.current?.select();
      });
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
          setError("SEARCH_FAILED. RETRY.");
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
      if (event.key === "Escape" && isMobileOverlayOpen) {
        setIsMobileOverlayOpen(false);
      }
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
    flatResults.forEach((entry, index) => map.set(makeResultKey(entry.group, entry.item), index));
    return map;
  }, [flatResults]);

  const clampedActiveIndex = useMemo(() => {
    if (flatResults.length === 0) return -1;
    if (activeIndex < 0) return 0;
    return Math.min(activeIndex, flatResults.length - 1);
  }, [activeIndex, flatResults.length]);

  useEffect(() => {
    if (clampedActiveIndex < 0) return;
    const el = document.querySelector<HTMLElement>(`[data-search-index='${clampedActiveIndex}']`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
      setActiveIndex((prev) => (prev <= 0 ? 0 : prev - 1));
    }
    if (event.key === "Enter" && clampedActiveIndex >= 0 && flatResults.length > 0) {
      event.preventDefault();
      const target = flatResults[clampedActiveIndex];
      const key = makeResultKey(target.group, target.item);
      setExpandedKey((prev) => (prev === key ? null : key));
    }
  }, [clampedActiveIndex, flatResults]);

  const renderResults = () => {
    const isIdle = query.trim().length < 2 && !shouldSearch;
    const total = displayResults?.total ?? 0;

    return (
      <div className="space-y-4">
        {displayIsLoading && (
          <div className="flex items-center gap-2 border-4 border-[#ff00ff] bg-black p-4 text-[#ff00ff]">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-xs font-black uppercase tracking-widest">SEARCHING...</span>
          </div>
        )}

        {displayError && (
          <div className="border-4 border-red-500 bg-black p-4 text-xs font-black text-red-500">
            {displayError}
          </div>
        )}

        {isIdle && (
          <div className="space-y-4">
            {history.length > 0 && (
              <section className="border-4 border-[#00ffff] bg-black p-4">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#00ffff]">
                  <History className="size-3" />
                  HISTORY
                </div>
                <div className="flex flex-wrap gap-2">
                  {history.map((entry) => (
                    <button
                      key={entry}
                      onClick={() => applySuggestion(entry)}
                      className="border-2 border-[#00ffff] px-2 py-1 text-[10px] font-bold text-[#00ffff] transition-colors hover:bg-[#00ffff] hover:text-black"
                    >
                      {entry}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="border-4 border-[#ffff00] bg-black p-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#ffff00]">TIPS</h3>
              <ul className="mt-2 space-y-1 text-[11px] text-white/60">
                <li>// Use exact activity names for precision</li>
                <li>// Search schedules like &quot;*/15&quot; or &quot;daily&quot;</li>
                <li>// Use path fragments for documents</li>
              </ul>
            </section>

            <section className="border-4 border-[#ff00ff] bg-black p-4">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#ff00ff]">
                <Radar className="size-3" />
                RECENT_ACTIVITY
              </div>
              <div className="space-y-2">
                {(recentActivities ?? []).slice(0, widget ? 3 : 5).map((activity: Doc<"activities">) => (
                  <article key={activity._id} className="border-l-2 border-[#ff00ff]/50 bg-white/5 px-3 py-2">
                    <p className="text-xs font-bold text-white">{activity.title}</p>
                    <p className="mt-1 text-[10px] text-white/50">
                      {activity.type.toUpperCase()} // {formatTimestamp(activity.timestamp)}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}

        {!displayIsLoading && shouldSearch && displayResults && total === 0 && (
          <div className="border-4 border-dashed border-white/30 bg-black p-6 text-center">
            <FileSearch className="mx-auto size-8 text-white/50" />
            <p className="mt-3 text-xs font-black uppercase text-white/50">NO_MATCHES</p>
          </div>
        )}

        {!displayIsLoading && shouldSearch && displayResults && total > 0 && (
          <div className="space-y-4">
            <ResultSection
              group="activities"
              title="ACTIVITIES"
              icon={Radar}
              count={displayResults.activities.length}
              collapsed={collapsed.activities}
              onToggle={() => setCollapsed((p) => ({ ...p, activities: !p.activities }))}
              color="#ff00ff"
            >
              {displayResults.activities.map((item) => {
                const key = makeResultKey("activities", item);
                const index = resultIndexMap.get(key) ?? -1;
                return (
                  <ResultCard
                    key={key}
                    index={index}
                    query={debouncedQuery}
                    item={item}
                    active={index === clampedActiveIndex}
                    expanded={expandedKey === key}
                    onSelect={() => {
                      setActiveIndex(index);
                      setExpandedKey((p) => (p === key ? null : key));
                    }}
                  />
                );
              })}
            </ResultSection>

            <ResultSection
              group="tasks"
              title="SCHEDULED"
              icon={Clock3}
              count={displayResults.tasks.length}
              collapsed={collapsed.tasks}
              onToggle={() => setCollapsed((p) => ({ ...p, tasks: !p.tasks }))}
              color="#00ffff"
            >
              {displayResults.tasks.map((item) => {
                const key = makeResultKey("tasks", item);
                const index = resultIndexMap.get(key) ?? -1;
                return (
                  <ResultCard
                    key={key}
                    index={index}
                    query={debouncedQuery}
                    item={item}
                    active={index === clampedActiveIndex}
                    expanded={expandedKey === key}
                    onSelect={() => {
                      setActiveIndex(index);
                      setExpandedKey((p) => (p === key ? null : key));
                    }}
                  />
                );
              })}
            </ResultSection>

            <ResultSection
              group="documents"
              title="DOCUMENTS"
              icon={FileText}
              count={displayResults.documents.length}
              collapsed={collapsed.documents}
              onToggle={() => setCollapsed((p) => ({ ...p, documents: !p.documents }))}
              color="#ffff00"
            >
              {displayResults.documents.map((item) => {
                const key = makeResultKey("documents", item);
                const index = resultIndexMap.get(key) ?? -1;
                return (
                  <ResultCard
                    key={key}
                    index={index}
                    query={debouncedQuery}
                    item={item}
                    active={index === clampedActiveIndex}
                    expanded={expandedKey === key}
                    onSelect={() => {
                      setActiveIndex(index);
                      setExpandedKey((p) => (p === key ? null : key));
                    }}
                  />
                );
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
        <section className={cn("border-4 border-[#ff00ff] bg-black", widget ? "p-4" : "p-5")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#ff00ff]">GLOBAL_SEARCH</p>
              <p className="mt-1 text-[10px] text-white/50">Unified index across all sources</p>
            </div>
            {!mobileMode && (
              <span className="border-2 border-[#ff00ff] px-2 py-1 text-[9px] font-black text-[#ff00ff]">
                CMD+K
              </span>
            )}
            {mobileMode && options?.onClose && (
              <button
                onClick={options.onClose}
                className="border-2 border-[#ff00ff] px-3 py-1 text-[10px] font-black text-[#ff00ff]"
              >
                CLOSE
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center border-2 border-[#ff00ff] bg-black">
            <span className="px-3 text-lg font-black text-[#ff00ff]">&gt;</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="SEARCH_QUERY..."
              className="h-12 flex-1 bg-transparent text-sm font-bold text-white placeholder:text-white/30 focus:outline-none"
            />
            <span className="animate-pulse px-3 text-lg text-[#ff00ff]">_</span>
          </div>

          <div className="mt-2 flex gap-3 text-[9px] text-white/40">
            <span>ARROWS: NAV</span>
            <span>/</span>
            <span>ENTER: EXPAND</span>
            <span>/</span>
            <span>{displayResults?.total ?? 0} MATCHES</span>
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
          onClick={() => {
            setIsMobileOverlayOpen(true);
            requestAnimationFrame(() => mobileInputRef.current?.focus());
          }}
          className="flex w-full items-center justify-between border-4 border-[#ff00ff] bg-black px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <TerminalSquare className="size-4 text-[#ff00ff]" />
            <span className="text-xs font-bold text-white">{query.trim() ? `> ${query}` : "> SEARCH..."}</span>
          </div>
          <span className="text-[9px] font-black text-[#ff00ff]">TAP</span>
        </button>
      </div>

      {isMobileOverlayOpen && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-black p-3 pb-24 md:hidden">
          {renderPrompt(mobileInputRef, { mobileMode: true, onClose: () => setIsMobileOverlayOpen(false) })}
        </div>
      )}
    </section>
  );
}

type ResultSectionProps = {
  group: GroupKey;
  title: string;
  icon: LucideIcon;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  color: string;
  children: ReactNode;
};

function ResultSection({ group, title, icon: Icon, count, collapsed, onToggle, color, children }: ResultSectionProps) {
  return (
    <section className="border-4 bg-black p-4" style={{ borderColor: color }} data-group={group}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 border-b-2 pb-3"
        style={{ borderColor: `${color}50` }}
      >
        <span className="flex items-center gap-2">
          <Icon className="size-4" style={{ color }} />
          <span className="text-xs font-black uppercase tracking-widest" style={{ color }}>{title}</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-[10px] font-black text-black" style={{ backgroundColor: color }}>{count}</span>
          {collapsed ? <ChevronRight className="size-4 text-white/50" /> : <ChevronDown className="size-4 text-white/50" />}
        </span>
      </button>
      {!collapsed && <div className="mt-3 space-y-2">{children}</div>}
    </section>
  );
}

type ResultCardProps = {
  item: SearchResult;
  query: string;
  index: number;
  active: boolean;
  expanded: boolean;
  onSelect: () => void;
};

function ResultCard({ item, query, index, active, expanded, onSelect }: ResultCardProps) {
  const iconElement = renderResultIcon(item, "size-4");

  return (
    <button
      type="button"
      data-search-index={index >= 0 ? index : undefined}
      onClick={onSelect}
      className={cn(
        "w-full border-l-4 bg-white/5 p-3 text-left transition-all",
        active ? "border-[#ff00ff] bg-[#ff00ff]/10" : "border-white/20 hover:border-white/50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 text-[#ff00ff]">{iconElement}</span>
          <div className="min-w-0">
            <p className="truncate text-xs font-black uppercase text-white">
              {highlightMatch(item.title, query)}
            </p>
            <p className="mt-1 line-clamp-2 text-[11px] text-white/50">
              {highlightMatch(item.snippet, query)}
            </p>
          </div>
        </div>
        <span className="bg-white/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-white/70">
          {item.subtype}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[9px] text-white/40">
        <span>{formatTimestamp(item.timestamp)}</span>
        <span className="h-2 w-12 bg-white/10">
          <span className="block h-full bg-[#ff00ff]" style={{ width: `${Math.round(item.relevance * 100)}%` }} />
        </span>
      </div>

      {expanded && (
        <div className="mt-2 border-t border-white/10 pt-2 text-[10px] text-white/50">
          {item.source === "activities" && <p>STATUS: {item.status.toUpperCase()}</p>}
          {item.source === "scheduledTasks" && (
            <>
              <p>SCHEDULE: {item.schedule}</p>
              <p>ENABLED: {item.enabled ? "YES" : "NO"}</p>
            </>
          )}
          {item.source === "documents" && <p>PATH: {item.path}</p>}
        </div>
      )}
    </button>
  );
}
