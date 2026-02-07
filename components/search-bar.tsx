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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type NavigableItem = {
  group: GroupKey;
  item: SearchResult;
};

type SearchBarProps = {
  widget?: boolean;
  className?: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightMatch(text: string, query: string) {
  if (!query) {
    return text;
  }

  const pattern = new RegExp(`(${escapeRegExp(query)})`, "ig");
  const segments = text.split(pattern);

  return segments.map((segment, index) => {
    if (segment.toLowerCase() === query.toLowerCase()) {
      return (
        <mark key={`${segment}-${index}`} className="rounded bg-primary/25 px-0.5 text-primary">
          {segment}
        </mark>
      );
    }

    return <Fragment key={`${segment}-${index}`}>{segment}</Fragment>;
  });
}

function formatTimestamp(timestamp: number | null) {
  if (!timestamp) {
    return "Unknown";
  }

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

function getRelevanceLabel(value: number) {
  if (value >= 0.75) {
    return "high";
  }

  if (value >= 0.45) {
    return "medium";
  }

  return "low";
}

function getActivityTypeIcon(type: string): LucideIcon {
  switch (type) {
    case "email":
      return Mail;
    case "code":
      return Code2;
    case "cron":
      return Clock3;
    case "search":
      return Search;
    case "message":
      return MessageSquare;
    case "file":
      return File;
    case "browser":
      return Globe;
    default:
      return Cpu;
  }
}

function getTaskTypeIcon(type: string): LucideIcon {
  switch (type) {
    case "cron":
      return Clock3;
    case "reminder":
      return Bell;
    default:
      return Repeat2;
  }
}

function getDocumentTypeIcon(type: string): LucideIcon {
  switch (type) {
    case "memory":
      return Database;
    case "config":
      return Settings2;
    case "skill":
      return BookOpen;
    default:
      return FileText;
  }
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

function getTimestampLabel(item: SearchResult) {
  if (item.source === "activities") {
    return "Logged";
  }

  if (item.source === "scheduledTasks") {
    return "Task Time";
  }

  return "Indexed";
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
      return parsed
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .slice(0, MAX_HISTORY);
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
    if (normalized.length < 2) {
      return;
    }

    setHistory((previous) => {
      const next = [
        normalized,
        ...previous.filter((entry) => entry.toLowerCase() !== normalized.toLowerCase()),
      ].slice(0, MAX_HISTORY);

      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage write errors.
      }

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
      // Reset via timer to avoid synchronous setState in effect body.
      const resetTimer = window.setTimeout(() => setDebouncedQuery(""), 0);
      return () => window.clearTimeout(resetTimer);
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
          setError("Search request failed. Retry in a moment.");
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
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

    return () => {
      window.removeEventListener("keydown", onGlobalKeyDown);
    };
  }, [focusSearch, isMobileOverlayOpen]);

  const flatResults = useMemo(() => {
    const list: NavigableItem[] = [];

    if (!displayResults) {
      return list;
    }

    if (!collapsed.activities) {
      for (const item of displayResults.activities) {
        list.push({ group: "activities", item });
      }
    }

    if (!collapsed.tasks) {
      for (const item of displayResults.tasks) {
        list.push({ group: "tasks", item });
      }
    }

    if (!collapsed.documents) {
      for (const item of displayResults.documents) {
        list.push({ group: "documents", item });
      }
    }

    return list;
  }, [collapsed.activities, collapsed.documents, collapsed.tasks, displayResults]);

  const resultIndexMap = useMemo(() => {
    const indexMap = new Map<string, number>();

    flatResults.forEach((entry, index) => {
      indexMap.set(makeResultKey(entry.group, entry.item), index);
    });

    return indexMap;
  }, [flatResults]);

  // Clamp activeIndex to flat results bounds (derived, not in an effect).
  const clampedActiveIndex = useMemo(() => {
    if (flatResults.length === 0) return -1;
    if (activeIndex < 0) return 0;
    return Math.min(activeIndex, flatResults.length - 1);
  }, [activeIndex, flatResults.length]);

  useEffect(() => {
    if (clampedActiveIndex < 0) {
      return;
    }

    const element = document.querySelector<HTMLElement>(`[data-search-index='${clampedActiveIndex}']`);
    element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [clampedActiveIndex]);

  const onInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (flatResults.length === 0) {
          return;
        }

        setActiveIndex((previous) => {
          if (previous < 0) {
            return 0;
          }

          return Math.min(previous + 1, flatResults.length - 1);
        });
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (flatResults.length === 0) {
          return;
        }

        setActiveIndex((previous) => {
          if (previous <= 0) {
            return 0;
          }

          return previous - 1;
        });
      }

      if (event.key === "Enter" && clampedActiveIndex >= 0 && flatResults.length > 0) {
        event.preventDefault();
        const target = flatResults[clampedActiveIndex];
        const key = makeResultKey(target.group, target.item);

        setExpandedKey((previous) => (previous === key ? null : key));
      }
    },
    [clampedActiveIndex, flatResults],
  );

  const renderResults = () => {
    const isIdle = query.trim().length < 2 && !shouldSearch;
    const total = displayResults?.total ?? 0;

    return (
      <div className="space-y-4">
        {displayIsLoading && (
          <div className="panel-frame rounded-xl border-primary/30 p-4 text-sm text-primary">
            <div className="flex items-center gap-2 font-mono uppercase tracking-[0.18em]">
              <Loader2 className="size-4 animate-spin" />
              Searching
              <span className="terminal-dots" />
            </div>
          </div>
        )}

        {displayError && (
          <div className="panel-frame rounded-xl border-red-500/40 p-4 text-sm text-red-300">
            <p>{displayError}</p>
          </div>
        )}

        {isIdle && (
          <div className="space-y-4">
            {history.length > 0 && (
              <section className="panel-frame rounded-xl p-4">
                <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80">
                  <History className="size-3.5" />
                  Recent Queries
                </div>
                <div className="flex flex-wrap gap-2">
                  {history.map((entry) => (
                    <Button
                      key={entry}
                      size="xs"
                      variant="outline"
                      className="font-mono text-[11px]"
                      onClick={() => applySuggestion(entry)}
                    >
                      {entry}
                    </Button>
                  ))}
                </div>
              </section>
            )}

            <section className="panel-frame rounded-xl p-4">
              <h3 className="font-display text-xs uppercase tracking-[0.2em] text-primary/90">Search Tips</h3>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                <li>Use exact activity names for precision.</li>
                <li>Search schedules like &ldquo;*/15&rdquo; or &ldquo;daily report&rdquo;.</li>
                <li>Use config keys or path fragments for documents.</li>
              </ul>
            </section>

            <section className="panel-frame rounded-xl p-4">
              <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary/80">
                <Radar className="size-3.5" />
                Recent Activity
              </div>
              <div className="space-y-2">
                {(recentActivities ?? []).slice(0, widget ? 3 : 5).map((activity: Doc<"activities">) => (
                  <article key={activity._id} className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                    <p className="text-xs text-foreground">{activity.title}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {activity.type} · {formatTimestamp(activity.timestamp)}
                    </p>
                  </article>
                ))}
                {!recentActivities && <p className="text-xs text-muted-foreground">Syncing recent activity...</p>}
              </div>
            </section>
          </div>
        )}

        {!displayIsLoading && shouldSearch && displayResults && total === 0 && (
          <div className="panel-frame rounded-xl border-dashed p-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 text-primary">
              <FileSearch className="size-4" />
              <span className="font-display text-xs uppercase tracking-[0.18em]">No matches found</span>
            </div>
            <p className="mt-3 text-xs">Try different terms, shorter fragments, or alternate type filters.</p>
          </div>
        )}

        {!displayIsLoading && shouldSearch && displayResults && total > 0 && (
          <div className="space-y-4">
            <ResultSection
              group="activities"
              title="Activities"
              icon={Radar}
              count={displayResults.activities.length}
              collapsed={collapsed.activities}
              onToggle={() => setCollapsed((previous) => ({ ...previous, activities: !previous.activities }))}
            >
              {displayResults.activities.map((item) => {
                const resultKey = makeResultKey("activities", item);
                const index = resultIndexMap.get(resultKey) ?? -1;

                return (
                  <ResultCard
                    key={resultKey}
                    index={index}
                    query={debouncedQuery}
                    item={item}
                    active={index === clampedActiveIndex}
                    expanded={expandedKey === resultKey}
                    onSelect={() => {
                      setActiveIndex(index);
                      setExpandedKey((previous) => (previous === resultKey ? null : resultKey));
                    }}
                  />
                );
              })}
            </ResultSection>

            <ResultSection
              group="tasks"
              title="Scheduled Tasks"
              icon={Clock3}
              count={displayResults.tasks.length}
              collapsed={collapsed.tasks}
              onToggle={() => setCollapsed((previous) => ({ ...previous, tasks: !previous.tasks }))}
            >
              {displayResults.tasks.map((item) => {
                const resultKey = makeResultKey("tasks", item);
                const index = resultIndexMap.get(resultKey) ?? -1;

                return (
                  <ResultCard
                    key={resultKey}
                    index={index}
                    query={debouncedQuery}
                    item={item}
                    active={index === clampedActiveIndex}
                    expanded={expandedKey === resultKey}
                    onSelect={() => {
                      setActiveIndex(index);
                      setExpandedKey((previous) => (previous === resultKey ? null : resultKey));
                    }}
                  />
                );
              })}
            </ResultSection>

            <ResultSection
              group="documents"
              title="Documents"
              icon={FileText}
              count={displayResults.documents.length}
              collapsed={collapsed.documents}
              onToggle={() => setCollapsed((previous) => ({ ...previous, documents: !previous.documents }))}
            >
              {displayResults.documents.map((item) => {
                const resultKey = makeResultKey("documents", item);
                const index = resultIndexMap.get(resultKey) ?? -1;

                return (
                  <ResultCard
                    key={resultKey}
                    index={index}
                    query={debouncedQuery}
                    item={item}
                    active={index === clampedActiveIndex}
                    expanded={expandedKey === resultKey}
                    onSelect={() => {
                      setActiveIndex(index);
                      setExpandedKey((previous) => (previous === resultKey ? null : resultKey));
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

  const renderPrompt = (
    inputRef: RefObject<HTMLInputElement | null>,
    options?: { mobileMode?: boolean; onClose?: () => void },
  ) => {
    const mobileMode = options?.mobileMode ?? false;

    return (
      <div className="space-y-4">
        <section className={cn("panel-frame rounded-2xl", widget ? "p-4" : "p-5 md:p-6")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-xs uppercase tracking-[0.22em] text-primary/85">Global Search</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Unified index across activities, schedules, and workspace docs.
              </p>
            </div>
            {!mobileMode && (
              <Badge variant="outline" className="rounded-md border-primary/40 bg-primary/10 font-mono text-[10px] uppercase">
                Cmd+K / Ctrl+K
              </Badge>
            )}
            {mobileMode && options?.onClose && (
              <Button size="xs" variant="outline" className="font-display uppercase tracking-[0.14em]" onClick={options.onClose}>
                Close
              </Button>
            )}
          </div>

          <div className="relative mt-3 flex items-center rounded-xl border border-primary/35 bg-black/40 px-3 shadow-[inset_0_0_0_1px_#8cf5931f]">
            <span className="font-mono text-sm text-primary/90">&gt;</span>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="search activities, cron tasks, memory files..."
              className="h-12 w-full bg-transparent px-2 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <span className="terminal-cursor ml-1 text-primary/90">_</span>

            {!mobileMode && (
              <div className="ml-3 hidden items-center gap-1 rounded-md border border-primary/35 bg-primary/10 px-2 py-1 text-[10px] text-primary/90 sm:flex">
                <Command className="size-3" />
                K
              </div>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>Arrow keys to navigate</span>
            <span className="text-border">/</span>
            <span>Enter to expand</span>
            <span className="text-border">/</span>
            <span>{displayResults?.total ?? 0} matches</span>
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
            requestAnimationFrame(() => {
              mobileInputRef.current?.focus();
            });
          }}
          className="panel-frame flex w-full items-center justify-between rounded-2xl border-primary/35 px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <TerminalSquare className="size-4 text-primary" />
            <span className="font-mono text-sm text-foreground">{query.trim() ? `> ${query}` : "> search mission control"}</span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.16em] text-primary/80">Tap</span>
        </button>
      </div>

      {isMobileOverlayOpen && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-background/95 p-3 pb-24 backdrop-blur-md md:hidden">
          {renderPrompt(mobileInputRef, {
            mobileMode: true,
            onClose: () => setIsMobileOverlayOpen(false),
          })}
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
  children: ReactNode;
};

function ResultSection({
  group,
  title,
  icon: Icon,
  count,
  collapsed,
  onToggle,
  children,
}: ResultSectionProps) {
  return (
    <section className="panel-frame rounded-2xl p-4" data-group={group}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 border-b border-border/70 pb-3 text-left"
      >
        <span className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          <span className="font-display text-sm uppercase tracking-[0.16em] text-primary">{title}</span>
        </span>

        <span className="flex items-center gap-2">
          <Badge variant="outline" className="rounded-md font-mono text-[10px]">
            {count}
          </Badge>
          {collapsed ? <ChevronRight className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
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
  const iconElement = renderResultIcon(item, "size-3.5");
  const relevanceLabel = getRelevanceLabel(item.relevance);

  return (
    <button
      type="button"
      data-search-index={index >= 0 ? index : undefined}
      onClick={onSelect}
      className={cn(
        "search-fade-in w-full rounded-xl border bg-card/45 p-3 text-left transition",
        active
          ? "border-primary/60 bg-primary/10 shadow-[0_0_20px_-10px_var(--color-primary)]"
          : "border-border/70 hover:border-primary/40 hover:bg-primary/5",
      )}
      style={{ animationDelay: `${Math.max(0, index) * 35}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 rounded-md border border-primary/40 bg-primary/10 p-1 text-primary">
            {iconElement}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-xs uppercase tracking-[0.15em] text-foreground">
              {highlightMatch(item.title, query)}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{highlightMatch(item.snippet, query)}</p>
          </div>
        </div>

        <Badge variant="outline" className="rounded-md px-1.5 font-mono text-[10px] uppercase">
          {item.subtype}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.12em]">
        <Badge variant="ghost" className="h-5 rounded-md border border-border bg-black/20 px-1.5 font-mono text-[10px]">
          {getTimestampLabel(item)} {formatTimestamp(item.timestamp)}
        </Badge>

        <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-primary/90">
          rel:{relevanceLabel}
          <span className="inline-flex h-1.5 w-12 overflow-hidden rounded-full bg-muted">
            <span className="h-full bg-primary" style={{ width: `${Math.round(item.relevance * 100)}%` }} />
          </span>
        </span>
      </div>

      {expanded && (
        <div className="mt-3 rounded-lg border border-border/70 bg-black/20 p-2 text-[11px] text-muted-foreground">
          {item.source === "activities" && (
            <p>
              status: <span className="uppercase text-foreground">{item.status}</span>
            </p>
          )}
          {item.source === "scheduledTasks" && (
            <>
              <p>schedule: {item.schedule}</p>
              <p>enabled: {item.enabled ? "yes" : "no"}</p>
            </>
          )}
          {item.source === "documents" && <p>path: {item.path}</p>}
        </div>
      )}
    </button>
  );
}
