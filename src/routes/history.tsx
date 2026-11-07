import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, History as HistoryIcon, Search, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useHistory } from "@/lib/store";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Translation History — Signa" },
      { name: "description", content: "Review, search and favourite your previous ASL translations." },
      { property: "og:title", content: "Translation History — Signa" },
      { property: "og:description", content: "Your saved ASL translations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [items, setItems] = useHistory();
  const [q, setQ] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const shown = items.filter((i) => i.text.toLowerCase().includes(q.toLowerCase()) && (!favOnly || i.favorite));

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold">History</h1>
      <div className="mt-5 flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search translations</span>
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search translations" className="h-12 w-full rounded-2xl border border-input bg-card pl-11 pr-4 outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <button onClick={() => setFavOnly(!favOnly)} aria-pressed={favOnly} className={`flex h-12 items-center gap-2 rounded-2xl px-4 font-semibold transition active:scale-95 ${favOnly ? "bg-primary text-primary-foreground" : "bg-card shadow-card"}`}>
          <Star className="h-4 w-4" aria-hidden /> Saved
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="mt-10 rounded-[2rem] bg-card p-10 text-center shadow-card">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-primary/10 text-primary"><HistoryIcon className="h-8 w-8" aria-hidden /></div>
          <p className="mt-4 text-lg font-bold">{items.length ? "No matches" : "No translations yet"}</p>
          <p className="text-muted-foreground">{items.length ? "Try a different search." : "Saved translations will show up here."}</p>
          {!items.length && <Link to="/translator" search={{}} className="mt-5 inline-flex h-12 items-center rounded-2xl bg-brand px-6 font-bold text-primary-foreground">Start Translating</Link>}
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {shown.map((i) => (
            <li key={i.id} className="animate-rise rounded-3xl bg-card p-5 shadow-card">
              <p className="text-xl font-bold break-words">{i.text}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {new Date(i.createdAt).toLocaleString()} · Confidence {Math.round(i.confidence * 100)}%
                </p>
                <div className="flex gap-1">
                  <button aria-label={i.favorite ? "Remove from saved" : "Save phrase"} aria-pressed={i.favorite} onClick={() => setItems((all) => all.map((x) => (x.id === i.id ? { ...x, favorite: !x.favorite } : x)))} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted">
                    <Star className={`h-5 w-5 ${i.favorite ? "fill-primary text-primary" : ""}`} aria-hidden />
                  </button>
                  <button aria-label="Copy translation" onClick={async () => { await navigator.clipboard.writeText(i.text); toast.success("Copied"); }} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-muted"><Copy className="h-5 w-5" aria-hidden /></button>
                  <button aria-label="Delete translation" onClick={() => setItems((all) => all.filter((x) => x.id !== i.id))} className="grid h-11 w-11 place-items-center rounded-xl text-destructive hover:bg-destructive/10"><Trash2 className="h-5 w-5" aria-hidden /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
