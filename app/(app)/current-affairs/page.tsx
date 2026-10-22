"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Newspaper,
  RefreshCw,
  ExternalLink,
  BookOpen,
  History,
  FilePlus2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { CurrentAffairsPointDialog } from "@/components/CurrentAffairsPointDialog";
import { ReviseChatDialog } from "@/components/ReviseChatDialog";
import { CurrentAffairsTabs } from "@/components/CurrentAffairsTabs";
import { useErrorPopup } from "@/components/ErrorPopup";
import { readApiError, toAppError } from "@/lib/client-errors";
import { getStoredModel } from "@/lib/models";
import {
  CA_CATEGORIES,
  CA_DIVISION_LABELS,
  CA_CATEGORY_IDS,
  categoryById,
  dateLabel,
  isValidDateString,
  monthLabel,
  shortDayLabel,
  type CADivision,
} from "@/lib/current-affairs-config";

interface CAItem {
  point: string;
  category: string;
  division: CADivision;
  staticLink?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourcePublisher?: string;
}

interface Digest {
  date: string;
  monthKey: string;
  itemCount: number;
  items: CAItem[];
  inMonthly: boolean;
  updatedAt: string;
}

interface MonthlySummary {
  noteId: string;
  title: string;
  days: number;
  items: number;
}

interface HistoryEntry {
  date: string;
  count: number;
  inMonthly: boolean;
}

type Filter = "all" | CADivision;

const AUTO_REFRESH_KEY = "ssc_ca_auto_refresh";
const AUTO_REFRESH_MS = 20 * 60 * 1000;

export default function CurrentAffairsPage() {
  const { showError } = useErrorPopup();

  const [today, setToday] = useState("");
  const [date, setDate] = useState("");
  const [digest, setDigest] = useState<Digest | null>(null);
  const [monthly, setMonthly] = useState<MonthlySummary | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [monthKey, setMonthKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [addingMonthly, setAddingMonthly] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [dialogItem, setDialogItem] = useState<CAItem | null>(null);
  const [reviseItem, setReviseItem] = useState<CAItem | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const autoStarted = useRef<string | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(AUTO_REFRESH_KEY) === "off") setAutoRefresh(false);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const cat = new URLSearchParams(window.location.search).get("category");
    if (cat && CA_CATEGORY_IDS.includes(cat)) setCategoryFilter(cat);
  }, []);

  const toggleAutoRefresh = () => {
    setAutoRefresh((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AUTO_REFRESH_KEY, next ? "on" : "off");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const load = useCallback(
    async (target?: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/current-affairs${target ? `?date=${target}` : ""}`);
        if (!res.ok) {
          showError(await readApiError(res, "Failed to load current affairs"));
          return null;
        }
        const data = await res.json();
        setToday(data.today);
        setDate(data.date);
        setDigest(data.digest);
        setMonthly(data.monthly);
        setHistory(data.history);
        setMonthKey(data.monthKey);
        return data as { today: string; date: string; digest: Digest | null };
      } catch (err) {
        showError(toAppError(err, "Failed to load current affairs"));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [showError]
  );

  const generate = useCallback(
    async (refresh: boolean, silent = false) => {
      const model = getStoredModel();
      if (refresh) setRefreshing(true);
      else setGenerating(true);
      if (!silent) setNotice("");

      try {
        const res = await fetch("/api/current-affairs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh, model }),
        });
        if (!res.ok) {
          showError(await readApiError(res, "Failed to generate current affairs", model));
          return;
        }
        const data = await res.json();
        setDigest(data.digest);
        setMonthly(data.monthly);
        setDate(data.digest.date);
        setHistory((prev) => {
          const entry = {
            date: data.digest.date,
            count: data.digest.itemCount,
            inMonthly: data.digest.inMonthly,
          };
          return [entry, ...prev.filter((h) => h.date !== entry.date)];
        });

        if (data.status === "no_new") setNotice("No new stories since your last refresh.");
        else if (data.status === "updated")
          setNotice(`${data.newCount} new point${data.newCount === 1 ? "" : "s"} added.`);
        else if (data.status === "created")
          setNotice(`Built today's list with ${data.digest.itemCount} points.`);
      } catch (err) {
        showError(toAppError(err, "Failed to generate current affairs", model));
      } finally {
        setGenerating(false);
        setRefreshing(false);
      }
    },
    [showError]
  );

  // First visit of the day: load, then build today's list automatically
  useEffect(() => {
    (async () => {
      const wanted = new URLSearchParams(window.location.search).get("date");
      const data = await load(wanted && isValidDateString(wanted) ? wanted : undefined);
      if (data && !data.digest && data.date === data.today && autoStarted.current !== data.date) {
        autoStarted.current = data.date;
        generate(false);
      }
    })();
  }, [load, generate]);

  // Keep today's list fresh while the page is open (only unseen stories are sent to the AI)
  useEffect(() => {
    if (!autoRefresh || !digest || !today || date !== today) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") generate(true, true);
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, digest, today, date, generate]);

  const addToMonthly = async () => {
    if (!digest) return;
    setAddingMonthly(true);
    setNotice("");
    try {
      const res = await fetch("/api/current-affairs/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: digest.date }),
      });
      if (!res.ok) {
        showError(await readApiError(res, "Failed to update the monthly note"));
        return;
      }
      const data = await res.json();
      setMonthly({ noteId: data.noteId, title: data.title, days: data.days, items: data.items });
      setDigest((prev) => (prev ? { ...prev, inMonthly: true } : prev));
      setHistory((prev) => prev.map((h) => (h.date === digest.date ? { ...h, inMonthly: true } : h)));
      setNotice(
        data.created
          ? `Created "${data.title}" with ${data.items} points.`
          : `Updated "${data.title}" — ${data.days} day${data.days === 1 ? "" : "s"}, ${data.items} points.`
      );
    } catch (err) {
      showError(toAppError(err, "Failed to update the monthly note"));
    } finally {
      setAddingMonthly(false);
    }
  };

  const visibleGroups = useMemo(() => {
    if (!digest) return [];
    return CA_CATEGORIES.filter((c) => (filter === "all" || c.division === filter) && (!categoryFilter || c.id === categoryFilter))
      .map((c) => ({ category: c, items: digest.items.filter((i) => i.category === c.id) }))
      .filter((g) => g.items.length > 0);
  }, [digest, filter, categoryFilter]);

  const counts = useMemo(() => {
    const gs = digest?.items.filter((i) => i.division === "gs").length ?? 0;
    const st = digest?.items.filter((i) => i.division === "static").length ?? 0;
    return { all: gs + st, gs, static: st };
  }, [digest]);

  const viewingToday = !!date && date === today;
  const savedDates = [...new Set([...history.map((h) => h.date), today].filter(Boolean))].sort();
  const prevDate = [...savedDates].reverse().find((d) => d < date);
  const nextDate = savedDates.find((d) => d > date);
  const busy = generating || refreshing;
  const monthName = monthKey ? monthLabel(monthKey) : "monthly";

  return (
    <div className="max-w-4xl mx-auto p-6">
      <CurrentAffairsTabs active="daily" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Newspaper size={22} className="text-[#1f4e9c]" aria-hidden="true" />
            Current Affairs
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
            <CalendarDays size={13} aria-hidden="true" />
            {date ? dateLabel(date) : "Loading…"}
            {viewingToday && <span className="text-[#1f4e9c] font-medium">· Today</span>}
          </p>
        </div>

        {viewingToday && digest && (
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={toggleAutoRefresh}
                className="rounded border-gray-300"
              />
              Auto-check every 20 min
            </label>
            <Button variant="secondary" size="sm" onClick={() => generate(true)} loading={refreshing} disabled={busy}>
              <RefreshCw size={14} aria-hidden="true" />
              Check for new stories
            </Button>
          </div>
        )}
      </div>

      {/* Day picker */}
      {date && (
        <div className="flex items-center gap-2 flex-wrap mb-5">
          <button
            onClick={() => prevDate && load(prevDate)}
            disabled={!prevDate || loading}
            aria-label="Previous saved day"
            title="Previous saved day"
            className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <input
            type="date"
            value={date}
            max={today || undefined}
            onChange={(e) => {
              if (e.target.value && isValidDateString(e.target.value)) load(e.target.value);
            }}
            aria-label="Choose a day"
            className="h-9 border border-gray-300 rounded-md px-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => nextDate && load(nextDate)}
            disabled={!nextDate || loading}
            aria-label="Next saved day"
            title="Next saved day"
            className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:pointer-events-none"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          {!viewingToday && today && (
            <Button variant="secondary" size="sm" onClick={() => load(today)} disabled={loading}>
              Today
            </Button>
          )}
          <span className="text-xs text-gray-400">
            {history.length} saved day{history.length === 1 ? "" : "s"} · arrows jump between them
          </span>
        </div>
      )}

      {/* Monthly notes card */}
      {digest && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{monthName} notes</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {monthly
                ? `${monthly.days} day${monthly.days === 1 ? "" : "s"} · ${monthly.items} points saved. Adding a day updates this one note.`
                : "One note per month, grouped by GS topic and Static GK. Add each day to build it."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {monthly && (
              <Link href={`/notes/${monthly.noteId}`}>
                <Button variant="secondary" size="sm">
                  <BookOpen size={14} aria-hidden="true" />
                  Open note
                </Button>
              </Link>
            )}
            <Button size="sm" onClick={addToMonthly} loading={addingMonthly} disabled={busy}>
              <FilePlus2 size={14} aria-hidden="true" />
              {digest.inMonthly
                ? `Update ${monthName} notes`
                : `Add ${shortDayLabel(digest.date)} to ${monthName} notes`}
            </Button>
          </div>
        </div>
      )}

      {notice && (
        <div role="status" className="mb-4 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
          {notice}
        </div>
      )}

      {/* Body */}
      {loading && !digest ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : generating ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <div className="flex justify-center mb-4">
            <LoadingSpinner size="lg" />
          </div>
          <p className="font-medium text-gray-900">Reading today&apos;s news…</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Collecting headlines and sorting them into GS topics and Static GK. This can take a minute or two,
            depending on the AI model you chose.
          </p>
        </div>
      ) : !digest ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <Newspaper size={36} className="mx-auto text-gray-300 mb-3" aria-hidden="true" />
          {viewingToday ? (
            <>
              <p className="font-medium text-gray-700">Today&apos;s list isn&apos;t ready yet</p>
              <p className="text-sm text-gray-500 mt-1">
                It is built from today&apos;s newspaper headlines the first time you open this page.
              </p>
              <Button className="mt-4" onClick={() => generate(false)} loading={generating}>
                Get today&apos;s current affairs
              </Button>
            </>
          ) : (
            <>
              <p className="font-medium text-gray-700">Nothing saved for this day</p>
              <p className="text-sm text-gray-500 mt-1">
                Lists are built from the day&apos;s news, so earlier days only exist if you opened this page then.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Division filter */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {(
              [
                ["all", "All", counts.all],
                ["gs", CA_DIVISION_LABELS.gs, counts.gs],
                ["static", CA_DIVISION_LABELS.static, counts.static],
              ] as Array<[Filter, string, number]>
            ).map(([value, label, count]) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filter === value
                    ? "bg-[#1f4e9c] text-white border-[#1f4e9c]"
                    : "border-gray-300 text-gray-600 hover:border-[#1f4e9c]"
                }`}
              >
                {label} <span className="opacity-70">· {count}</span>
              </button>
            ))}
          </div>

          {categoryFilter && (
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
              Showing only <strong>{categoryById(categoryFilter).label}</strong>
              <button
                onClick={() => setCategoryFilter(null)}
                className="text-xs text-[#1f4e9c] hover:underline"
              >
                Show all topics
              </button>
            </div>
          )}

          {visibleGroups.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-500">
              No points in this category yet today. Try &ldquo;Check for new stories&rdquo; later, or show all topics.
            </div>
          )}

          <div className="space-y-4">
            {visibleGroups.map(({ category, items }) => (
              <section
                key={category.id}
                aria-labelledby={`cat-${category.id}`}
                className="bg-white border border-gray-200 rounded-xl p-4"
              >
                <h2 id={`cat-${category.id}`} className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                      category.division === "gs" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {category.division === "gs" ? "GS" : "Static GK"}
                  </span>
                  {category.label}
                  <span className="text-xs font-normal text-gray-400">({items.length})</span>
                </h2>

                <ul className="space-y-3">
                  {items.map((item, i) => (
                    <li key={`${item.point.slice(0, 24)}-${i}`} className="flex gap-2.5">
                      <span className="text-[#1f4e9c] mt-1 flex-shrink-0" aria-hidden="true">
                        •
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 leading-relaxed">{item.point}</p>
                        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1">
                          {item.staticLink && (
                            <button
                              type="button"
                              onClick={() => setReviseItem(item)}
                              className="inline-flex items-center gap-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 cursor-pointer"
                              title="Revise this in a chat"
                            >
                              <BookOpen size={11} aria-hidden="true" />
                              Revise: {item.staticLink}
                            </button>
                          )}
                          {item.sourceUrl && (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-[#1f4e9c]"
                              title={item.sourceTitle}
                            >
                              <ExternalLink size={11} aria-hidden="true" />
                              {item.sourcePublisher || "Source"}
                            </a>
                          )}
                          <button
                            onClick={() => setDialogItem(item)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#1f4e9c] hover:underline"
                          >
                            <History size={11} aria-hidden="true" />
                            Background
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <p className="text-xs text-gray-400 mt-6">
            Points are summarised by AI from newspaper headlines (The Hindu, Indian Express, Times of India). Open the
            source link and verify important facts before relying on them.
          </p>
        </>
      )}
      <CurrentAffairsPointDialog
        point={dialogItem?.point ?? null}
        staticLink={dialogItem?.staticLink}
        onClose={() => setDialogItem(null)}
      />
      {reviseItem?.staticLink && (
        <ReviseChatDialog
          key={reviseItem.point}
          topic={reviseItem.staticLink}
          point={reviseItem.point}
          onClose={() => setReviseItem(null)}
        />
      )}
    </div>
  );
}
