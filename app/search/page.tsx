import { SearchBar } from "@/components/search-bar";

export default function SearchPage() {
  return (
    <div className="space-y-4 pb-4">
      <header className="panel-frame rounded-2xl p-6">
        <p className="font-display text-xs uppercase tracking-[0.22em] text-primary/80">Indexed Intel</p>
        <h1 className="mt-2 font-display text-3xl uppercase tracking-[0.14em]">Global Search</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Unified search across activities, scheduled tasks, and workspace documents with grouped result streams.
        </p>
      </header>
      <SearchBar />
    </div>
  );
}
