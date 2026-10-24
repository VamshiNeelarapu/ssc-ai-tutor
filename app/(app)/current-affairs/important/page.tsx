"use client";

import { useMemo, useState } from "react";
import { BookOpen, ExternalLink, History, Search, Star, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { BackgroundMarkdown } from "@/components/BackgroundMarkdown";
import { CurrentAffairsPointDialog } from "@/components/CurrentAffairsPointDialog";
import { CurrentAffairsTabs } from "@/components/CurrentAffairsTabs";
import { ReviseChatDialog } from "@/components/ReviseChatDialog";
import { useImportantPoints, type ImportantPoint } from "@/hooks/useImportantPoints";
import { CA_DIVISION_LABELS, categoryById, dateLabel, type CADivision } from "@/lib/current-affairs-config";

type Filter = "all" | CADivision;

export default function ImportantPointsPage() {
  const { points, loaded, remove, reload } = useImportantPoints();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [backgroundFor, setBackgroundFor] = useState<ImportantPoint | null>(null);
  const [reviseFor, setReviseFor] = useState<ImportantPoint | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = points.filter(
      (p) =>
        (filter === "all" || p.division === filter) &&
        (!q || p.point.toLowerCase().includes(q) || (p.staticLink ?? "").toLowerCase().includes(q))
    );
    const byDate = new Map<string, ImportantPoint[]>();
    for (const p of visible) byDate.set(p.date, [...(byDate.get(p.date) ?? []), p]);
    return [...byDate.entries()].sort(([a], [b]) => (a < b ? 1 : -1));
  }, [points, query, filter]);

  const shownCount = groups.reduce((n, [, list]) => n + list.length, 0);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-4">
        <Star size={22} className="text-amber-500 fill-amber-400" aria-hidden="true" />
        Current Affairs
      </h1>
      <CurrentAffairsTabs active="important" />

      <div className="flex items-center gap-3 flex-wrap mb-5">
        <div className="relative flex-1 min-w-[12rem]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your important points…"
            aria-label="Search important points"
            className="w-full h-9 pl-9 pr-3 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {(["all", "gs", "static"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === f
                ? "bg-[#1f4e9c] text-white border-[#1f4e9c]"
                : "border-gray-300 text-gray-600 hover:border-[#1f4e9c]"
            }`}
          >
            {f === "all" ? "All" : CA_DIVISION_LABELS[f]}
          </button>
        ))}
        <span className="text-xs text-gray-400">
          {shownCount} point{shownCount === 1 ? "" : "s"}
        </span>
      </div>

      {!loaded ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : points.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <Star size={36} className="mx-auto text-gray-300 mb-3" aria-hidden="true" />
          <p className="font-medium text-gray-700">No important points yet</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Tap <strong>Mark important</strong> under any point on the Daily or Monthly page. It is saved here by date,
            with its reference, background and the topic to revise.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10">No points match your search.</p>
      ) : (
        <div className="space-y-5">
          {groups.map(([date, list]) => (
            <section key={date} aria-labelledby={`imp-${date}`}>
              <h2 id={`imp-${date}`} className="text-sm font-semibold text-gray-900 mb-2">
                {dateLabel(date)} <span className="text-xs font-normal text-gray-400">({list.length})</span>
              </h2>
              <ul className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {list.map((p) => {
                  const category = categoryById(p.category);
                  return (
                    <li key={p.id} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                              p.division === "gs" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {category.label}
                          </span>
                          <p className="text-sm text-gray-800 leading-relaxed mt-2">{p.point}</p>

                          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-2">
                            {p.staticLink && (
                              <button
                                type="button"
                                onClick={() => setReviseFor(p)}
                                title="Revise this in a chat"
                                className="inline-flex items-center gap-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 cursor-pointer"
                              >
                                <BookOpen size={11} aria-hidden="true" />
                                Revise: {p.staticLink}
                              </button>
                            )}
                            {p.sourceUrl && (
                              <a
                                href={p.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={p.sourceTitle}
                                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#1f4e9c]"
                              >
                                <ExternalLink size={11} aria-hidden="true" />
                                Reference: {p.sourcePublisher || "Source"}
                              </a>
                            )}
                          </div>

                          {p.background ? (
                            <details className="mt-3 group">
                              <summary className="inline-flex items-center gap-1 text-xs font-medium text-[#1f4e9c] cursor-pointer select-none">
                                <History size={11} aria-hidden="true" />
                                Background (saved)
                              </summary>
                              <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                                <BackgroundMarkdown content={p.background} />
                                <button
                                  type="button"
                                  onClick={() => setBackgroundFor(p)}
                                  className="mt-2 text-xs text-gray-500 hover:text-[#1f4e9c]"
                                >
                                  Regenerate…
                                </button>
                              </div>
                            </details>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setBackgroundFor(p)}
                              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#1f4e9c] hover:underline"
                            >
                              <History size={11} aria-hidden="true" />
                              Get background
                            </button>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(p.id)}
                          aria-label="Remove from important"
                          title="Remove from important"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <CurrentAffairsPointDialog
        point={backgroundFor?.point ?? null}
        staticLink={backgroundFor?.staticLink}
        onClose={() => {
          setBackgroundFor(null);
          reload();
        }}
      />
      {reviseFor?.staticLink && (
        <ReviseChatDialog
          key={reviseFor.id}
          topic={reviseFor.staticLink}
          point={reviseFor.point}
          onClose={() => setReviseFor(null)}
        />
      )}
    </div>
  );
}
