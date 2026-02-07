"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, BookOpen, ChevronDown, ChevronRight, Clock3, Code2, Cpu, Database, File, FileSearch, FileText, Globe, History, Loader2, Mail, MessageSquare, Radar, Repeat2, Search, Settings2 } from "lucide-react";
import { useAction, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

const SEARCH_HISTORY_KEY = "mission-control:search-history:v1";
const MAX_HISTORY = 8;

type GroupKey = "activities" | "tasks" | "documents";
type ActivityResult = { id: string; source: "activities"; subtype: string; title: string; snippet: string; timestamp: number | null; relevance: number; status: string };
type TaskResult = { id: string; source: "scheduledTasks"; subtype: string; title: string; snippet: string; timestamp: number | null; relevance: number; schedule: string; enabled: boolean };
type DocumentResult = { id: string; source: "documents"; subtype: string; title: string; snippet: string; timestamp: number | null; relevance: number; path: string };
type UnifiedSearchResponse = { query: string; total: number; generatedAt: number; activities: ActivityResult[]; tasks: TaskResult[]; documents: DocumentResult[] };
type SearchResult = ActivityResult | TaskResult | DocumentResult;
type NavigableItem = { group: GroupKey; item: SearchResult };
type SearchBarProps = { widget?: boolean; className?: string };

function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function highlightMatch(text: string, query: string) { if (!query) return text; const pattern = new RegExp(`(${escapeRegExp(query)})`, "ig"); return text.split(pattern).map((seg, i) => seg.toLowerCase() === query.toLowerCase() ? <mark key={i} className="bg-white text-black">{seg}</mark> : <Fragment key={i}>{seg}</Fragment>); }
function formatTimestamp(ts: number | null) { if (!ts) return "—"; return new Date(ts).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function makeResultKey(group: GroupKey, item: SearchResult) { return `${group}:${item.id}`; }
function getActivityTypeIcon(type: string): LucideIcon { const icons: Record<string, LucideIcon> = { email: Mail, code: Code2, cron: Clock3, search: Search, message: MessageSquare, file: File, browser: Globe }; return icons[type] ?? Cpu; }
function getTaskTypeIcon(type: string): LucideIcon { return type === "cron" ? Clock3 : type === "reminder" ? Bell : Repeat2; }
function getDocumentTypeIcon(type: string): LucideIcon { const icons: Record<string, LucideIcon> = { memory: Database, config: Settings2, skill: BookOpen }; return icons[type] ?? FileText; }
function renderResultIcon(item: SearchResult, className: string): ReactNode { if (item.source === "activities") return <>{getActivityTypeIcon(item.subtype)({ className })}</>; if (item.source === "scheduledTasks") return <>{getTaskTypeIcon(item.subtype)({ className })}</>; return <>{getDocumentTypeIcon(item.subtype)({ className })}</>; }

export function SearchBar({ widget = false, className }: SearchBarProps) {
  const runUnifiedSearch = useAction(api.search.unifiedSearch);
  const recentActivities = useQuery(api.activities.list, { limit: widget ? 4 : 6 });

  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [history, setHistory] = useState<string[]>(() => { if (typeof window === "undefined") return []; try { const raw = localStorage.getItem(SEARCH_HISTORY_KEY); if (!raw) return []; const parsed = JSON.parse(raw); if (!Array.isArray(parsed)) return []; return parsed.filter((e): e is string => typeof e === "string").slice(0, MAX_HISTORY); } catch { return []; } });
  const [results, setResults] = useState<UnifiedSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [isMobileOverlayOpen, setIsMobileOverlayOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<GroupKey, boolean>>({ activities: false, tasks: false, documents: false });

  const shouldSearch = debouncedQuery.trim().length >= 2;

  const saveHistory = useCallback((term: string) => { const normalized = term.trim(); if (normalized.length < 2) return; setHistory((prev) => { const next = [normalized, ...prev.filter((e) => e.toLowerCase() !== normalized.toLowerCase())].slice(0, MAX_HISTORY); try { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next)); } catch {} return next; }); }, []);
  const applySuggestion = useCallback((term: string) => { setQuery(term); setDebouncedQuery(term); setExpandedKey(null); }, []);
  const focusSearch = useCallback(() => { const isMobile = window.matchMedia("(max-width: 767px)").matches; if (isMobile) { setIsMobileOverlayOpen(true); requestAnimationFrame(() => { mobileInputRef.current?.focus(); mobileInputRef.current?.select(); }); return; } desktopInputRef.current?.focus(); desktopInputRef.current?.select(); }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) { const timer = window.setTimeout(() => setDebouncedQuery(""), 0); return () => window.clearTimeout(timer); }
    const timer = window.setTimeout(() => {
      setDebouncedQuery(trimmed);
      const requestId = ++requestIdRef.current;
      setIsLoading(true); setError(null);
      runUnifiedSearch({ query: trimmed, limitPerType: widget ? 6 : 12 })
        .then((payload) => { if (requestId !== requestIdRef.current) return; const typedPayload = payload as UnifiedSearchResponse; setResults(typedPayload); setIsLoading(false); setExpandedKey(null); setActiveIndex(typedPayload.total > 0 ? 0 : -1); saveHistory(trimmed); })
        .catch(() => { if (requestId !== requestIdRef.current) return; setResults(null); setIsLoading(false); setError("Search failed"); });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, runUnifiedSearch, saveHistory, widget]);

  const displayResults = shouldSearch ? results : null;
  const displayError = shouldSearch ? error : null;
  const displayIsLoading = shouldSearch ? isLoading : false;

  useEffect(() => { const onGlobalKeyDown = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); focusSearch(); } if (event.key === "Escape" && isMobileOverlayOpen) setIsMobileOverlayOpen(false); }; window.addEventListener("keydown", onGlobalKeyDown); return () => window.removeEventListener("keydown", onGlobalKeyDown); }, [focusSearch, isMobileOverlayOpen]);

  const flatResults = useMemo(() => { const list: NavigableItem[] = []; if (!displayResults) return list; if (!collapsed.activities) for (const item of displayResults.activities) list.push({ group: "activities", item }); if (!collapsed.tasks) for (const item of displayResults.tasks) list.push({ group: "tasks", item }); if (!collapsed.documents) for (const item of displayResults.documents) list.push({ group: "documents", item }); return list; }, [collapsed, displayResults]);
  const resultIndexMap = useMemo(() => { const map = new Map<string, number>(); flatResults.forEach((e, i) => map.set(makeResultKey(e.group, e.item), i)); return map; }, [flatResults]);
  const clampedActiveIndex = useMemo(() => { if (flatResults.length === 0) return -1; if (activeIndex < 0) return 0; return Math.min(activeIndex, flatResults.length - 1); }, [activeIndex, flatResults.length]);

  useEffect(() => { if (clampedActiveIndex < 0) return; document.querySelector<HTMLElement>(`[data-search-index='${clampedActiveIndex}']`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [clampedActiveIndex]);

  const onInputKeyDown = useCallback((event: ReactKeyboardEvent<HTMLInputElement>) => { if (event.key === "ArrowDown") { event.preventDefault(); if (flatResults.length) setActiveIndex((p) => Math.min((p < 0 ? 0 : p + 1), flatResults.length - 1)); } if (event.key === "ArrowUp") { event.preventDefault(); if (flatResults.length) setActiveIndex((p) => Math.max(0, p - 1)); } if (event.key === "Enter" && clampedActiveIndex >= 0) { event.preventDefault(); const key = makeResultKey(flatResults[clampedActiveIndex].group, flatResults[clampedActiveIndex].item); setExpandedKey((p) => (p === key ? null : key)); } }, [clampedActiveIndex, flatResults]);

  const renderResults = () => {
    const isIdle = query.trim().length < 2;
    const total = displayResults?.total ?? 0;

    return (
      <div className="space-y-6">
        {displayIsLoading && (<div className="flex items-center gap-2 py-4 text-xs text-neutral-500"><Loader2 className="size-3 animate-spin" />Searching</div>)}
        {displayError && (<div className="py-4 text-xs text-white">{displayError}</div>)}

        {isIdle && (
          <div className="space-y-6">
            {history.length > 0 && (<section><p className="mb-2 text-xs text-neutral-600">Recent</p><div className="flex flex-wrap gap-1">{history.map((entry) => (<button key={entry} onClick={() => applySuggestion(entry)} className="border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-900 hover:text-white">{entry}</button>))}</div></section>)}
            <section><p className="mb-2 text-xs text-neutral-600">Tips</p><ul className="space-y-1 text-xs text-neutral-500"><li>Search by name</li><li>Use cron patterns</li><li>Search paths</li></ul></section>
            <section><p className="mb-2 text-xs text-neutral-600">Recent activity</p><div className="divide-y divide-neutral-800/50">{(recentActivities ?? []).slice(0, widget ? 3 : 5).map((a: Doc<"activities">) => (<article key={a._id} className="py-2"><p className="text-sm text-white">{a.title}</p><p className="mt-0.5 text-xs text-neutral-600">{a.type} · {formatTimestamp(a.timestamp)}</p></article>))}</div></section>
          </div>
        )}

        {!displayIsLoading && shouldSearch && displayResults && total === 0 && (<div className="py-8 text-center"><FileSearch className="mx-auto size-6 text-neutral-700" /><p className="mt-2 text-xs text-neutral-500">No matches</p></div>)}

        {!displayIsLoading && shouldSearch && displayResults && total > 0 && (
          <div className="space-y-6">
            <ResultSection group="activities" title="Activities" icon={Radar} count={displayResults.activities.length} collapsed={collapsed.activities} onToggle={() => setCollapsed((p) => ({ ...p, activities: !p.activities }))}>{displayResults.activities.map((item) => { const key = makeResultKey("activities", item); const idx = resultIndexMap.get(key) ?? -1; return <ResultCard key={key} index={idx} query={debouncedQuery} item={item} active={idx === clampedActiveIndex} expanded={expandedKey === key} onSelect={() => { setActiveIndex(idx); setExpandedKey((p) => (p === key ? null : key)); }} />; })}</ResultSection>
            <ResultSection group="tasks" title="Scheduled" icon={Clock3} count={displayResults.tasks.length} collapsed={collapsed.tasks} onToggle={() => setCollapsed((p) => ({ ...p, tasks: !p.tasks }))}>{displayResults.tasks.map((item) => { const key = makeResultKey("tasks", item); const idx = resultIndexMap.get(key) ?? -1; return <ResultCard key={key} index={idx} query={debouncedQuery} item={item} active={idx === clampedActiveIndex} expanded={expandedKey === key} onSelect={() => { setActiveIndex(idx); setExpandedKey((p) => (p === key ? null : key)); }} />; })}</ResultSection>
            <ResultSection group="documents" title="Documents" icon={FileText} count={displayResults.documents.length} collapsed={collapsed.documents} onToggle={() => setCollapsed((p) => ({ ...p, documents: !p.documents }))}>{displayResults.documents.map((item) => { const key = makeResultKey("documents", item); const idx = resultIndexMap.get(key) ?? -1; return <ResultCard key={key} index={idx} query={debouncedQuery} item={item} active={idx === clampedActiveIndex} expanded={expandedKey === key} onSelect={() => { setActiveIndex(idx); setExpandedKey((p) => (p === key ? null : key)); }} />; })}</ResultSection>
          </div>
        )}
      </div>
    );
  };

  const renderPrompt = (inputRef: RefObject<HTMLInputElement | null>, options?: { mobileMode?: boolean; onClose?: () => void }) => {
    const mobileMode = options?.mobileMode ?? false;
    return (
      <div className="space-y-6">
        <section className="border-b border-neutral-800 pb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-xs text-neutral-500">Search</p>
            {!mobileMode && <span className="text-[10px] text-neutral-600">⌘K</span>}
            {mobileMode && options?.onClose && <button onClick={options.onClose} className="text-xs text-neutral-500">Close</button>}
          </div>
          <div className="flex items-center border border-neutral-800">
            <Search className="mx-3 size-4 text-neutral-600" />
            <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onInputKeyDown} placeholder="Type to search..." className="h-10 flex-1 bg-transparent text-sm text-white placeholder:text-neutral-600 focus:outline-none" />
          </div>
          <div className="mt-2 flex gap-3 text-[10px] text-neutral-600"><span>↑↓ navigate</span><span>enter expand</span><span>{displayResults?.total ?? 0} results</span></div>
        </section>
        {renderResults()}
      </div>
    );
  };

  return (
    <section className={cn("space-y-6", className)}>
      <div className="hidden md:block">{renderPrompt(desktopInputRef)}</div>
      <div className="md:hidden"><button type="button" onClick={() => { setIsMobileOverlayOpen(true); requestAnimationFrame(() => mobileInputRef.current?.focus()); }} className="flex w-full items-center justify-between border border-neutral-800 px-4 py-3"><div className="flex items-center gap-2"><Search className="size-4 text-neutral-600" /><span className="text-sm text-neutral-500">{query.trim() || "Search"}</span></div><span className="text-[10px] text-neutral-600">Tap</span></button></div>
      {isMobileOverlayOpen && (<div className="fixed inset-0 z-[90] overflow-y-auto bg-neutral-950 p-4 pb-20 md:hidden">{renderPrompt(mobileInputRef, { mobileMode: true, onClose: () => setIsMobileOverlayOpen(false) })}</div>)}
    </section>
  );
}

function ResultSection({ group, title, icon: Icon, count, collapsed, onToggle, children }: { group: GroupKey; title: string; icon: LucideIcon; count: number; collapsed: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section data-group={group}>
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 border-b border-neutral-800 pb-2 text-left">
        <span className="flex items-center gap-2 text-xs text-neutral-400"><Icon className="size-3" />{title}</span>
        <span className="flex items-center gap-2 text-xs"><span className="text-neutral-600">{count}</span>{collapsed ? <ChevronRight className="size-3 text-neutral-600" /> : <ChevronDown className="size-3 text-neutral-600" />}</span>
      </button>
      {!collapsed && <div className="mt-2 divide-y divide-neutral-800/50">{children}</div>}
    </section>
  );
}

function ResultCard({ item, query, index, active, expanded, onSelect }: { item: SearchResult; query: string; index: number; active: boolean; expanded: boolean; onSelect: () => void }) {
  const iconElement = renderResultIcon(item, "size-3");
  return (
    <button type="button" data-search-index={index >= 0 ? index : undefined} onClick={onSelect} className={cn("w-full py-3 text-left transition-colors", active ? "bg-neutral-900" : "hover:bg-neutral-900/50")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2"><span className="mt-0.5 text-neutral-600">{iconElement}</span><div className="min-w-0"><p className="text-sm text-white">{highlightMatch(item.title, query)}</p><p className="mt-0.5 text-xs text-neutral-500 line-clamp-1">{highlightMatch(item.snippet, query)}</p></div></div>
        <span className="text-[10px] text-neutral-600">{item.subtype}</span>
      </div>
      <div className="mt-1 pl-5 flex items-center gap-2 text-[10px] text-neutral-600"><span>{formatTimestamp(item.timestamp)}</span></div>
      {expanded && (<div className="mt-2 pl-5 text-xs text-neutral-500">{item.source === "activities" && <p>Status: {item.status}</p>}{item.source === "scheduledTasks" && <><p>Schedule: {item.schedule}</p><p>Enabled: {item.enabled ? "Yes" : "No"}</p></>}{item.source === "documents" && <p>Path: {item.path}</p>}</div>)}
    </button>
  );
}
