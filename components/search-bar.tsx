"use client";

import { Fragment, useDeferredValue, useMemo, useState } from "react";
import { FileSearch, Loader2 } from "lucide-react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

function highlight(text: string, query: string) {
  if (!query) {
    return text;
  }

  const expression = new RegExp(`(${escapeRegExp(query)})`, "ig");
  const parts = text.split(expression);

  return parts.map((part, index) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      return (
        <mark key={`${part}-${index}`} className="rounded bg-primary/30 px-0.5 text-primary">
          {part}
        </mark>
      );
    }

    return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
  });
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const shouldSearch = deferredQuery.length > 1;

  const activities = useQuery(api.activities.search, shouldSearch ? { query: deferredQuery, limit: 8 } : "skip");
  const tasks = useQuery(api.scheduledTasks.search, shouldSearch ? { query: deferredQuery, limit: 8 } : "skip");
  const documents = useQuery(api.documents.search, shouldSearch ? { query: deferredQuery, limit: 8 } : "skip");

  const isLoading = shouldSearch && (!activities || !tasks || !documents);

  const total = useMemo(() => {
    if (!shouldSearch || !activities || !tasks || !documents) {
      return 0;
    }

    return activities.length + tasks.length + documents.length;
  }, [activities, documents, tasks, shouldSearch]);

  return (
    <section className="space-y-4">
      <div className="panel-frame rounded-2xl p-4">
        <label className="mb-2 block font-display text-xs uppercase tracking-[0.18em] text-primary/80">Global Search</label>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search activity titles, task names, and indexed document content..."
          className="h-12 rounded-xl border-primary/30 bg-background/70 font-mono text-sm"
        />
        <div className="mt-2 text-xs text-muted-foreground">{shouldSearch ? `${total} result(s)` : "Type at least 2 characters to search"}</div>
      </div>

      {!shouldSearch && (
        <div className="panel-frame rounded-xl border-dashed p-5 text-sm text-muted-foreground">
          Search is powered by Convex full-text indexes on activities, tasks, and documents.
        </div>
      )}

      {isLoading && (
        <div className="panel-frame flex items-center rounded-xl p-4 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin text-primary" /> Querying indexed records...
        </div>
      )}

      {shouldSearch && activities && tasks && documents && (
        <div className="space-y-4">
          <ResultGroup title="Activities" count={activities.length}>
            {activities.map((item) => (
              <article key={item._id} className="rounded-lg border border-border/70 bg-card/50 p-3">
                <p className="font-display text-xs uppercase tracking-[0.14em]">{highlight(item.title, deferredQuery)}</p>
                {item.description && <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>}
                <div className="mt-2 flex gap-2">
                  <Badge variant="outline" className="rounded-md uppercase">{item.type}</Badge>
                  <Badge variant="outline" className="rounded-md uppercase">{item.status}</Badge>
                </div>
              </article>
            ))}
          </ResultGroup>

          <ResultGroup title="Scheduled Tasks" count={tasks.length}>
            {tasks.map((task) => (
              <article key={task._id} className="rounded-lg border border-border/70 bg-card/50 p-3">
                <p className="font-display text-xs uppercase tracking-[0.14em]">{highlight(task.name, deferredQuery)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{task.schedule}</p>
                <Badge variant="outline" className="mt-2 rounded-md uppercase">{task.type}</Badge>
              </article>
            ))}
          </ResultGroup>

          <ResultGroup title="Documents" count={documents.length}>
            {documents.map((document) => (
              <article key={document._id} className="rounded-lg border border-border/70 bg-card/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-xs uppercase tracking-[0.14em]">{highlight(document.name, deferredQuery)}</p>
                  <Badge variant="outline" className="rounded-md uppercase">{document.type}</Badge>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{document.path}</p>
                <p className="mt-2 text-sm text-muted-foreground">{highlight(document.content.slice(0, 180), deferredQuery)}</p>
              </article>
            ))}
          </ResultGroup>

          {total === 0 && (
            <div className="panel-frame rounded-xl p-5 text-sm text-muted-foreground">
              <FileSearch className="mb-2 size-4 text-primary" />
              No matching results were found.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

type ResultGroupProps = {
  title: string;
  count: number;
  children: React.ReactNode;
};

function ResultGroup({ title, count, children }: ResultGroupProps) {
  return (
    <section className="panel-frame rounded-2xl p-4">
      <header className="mb-3 flex items-center justify-between border-b border-border/70 pb-3">
        <h3 className="font-display text-sm uppercase tracking-[0.18em] text-primary">{title}</h3>
        <Badge variant="outline" className="rounded-md">{count}</Badge>
      </header>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
