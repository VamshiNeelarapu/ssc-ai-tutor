"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarRange, BookOpen, ExternalLink, History, Star, FilePlus2, Check, Wand2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { CurrentAffairsPointDialog } from "@/components/CurrentAffairsPointDialog";
import { useImportantPoints } from "@/hooks/useImportantPoints";
import { ReviseChatDialog } from "@/components/ReviseChatDialog";
import { CurrentAffairsTabs } from "@/components/CurrentAffairsTabs";
import { useErrorPopup } from "@/components/ErrorPopup";
import { readApiError, toAppError } from "@/lib/client-errors";
import { getStoredModel } from "@/lib/models";
import {
  CA_CATEGORIES,
  CA_DIVISION_LABELS,
  istDateString,
  monthKeyOf,
  monthLabel,
  shortDayLabel,
  type CADivision,
} from "@/lib/current-affairs-config";

interface MonthItem {
  date: string;
  point: string;
  category: string;
  division: CADivision;
  staticLink?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourcePublisher?: string;
}

interface MonthData {
  month: string;
  monthLabel: string;
  days: Array<{ date: string; count: number; inMonthly: boolean }>;
  items: MonthItem[];
  monthly: { noteId: string; title: string; days: number; items: number } | null;
  availableMonths: Array<{ month: string; label: string; days: number }>;
}

type Filter = "all" | CADivision;

interface GenerateJob {
  state: "running" | "done" | "error";
  step: number;
  totalSteps: number;
  itemsAdded: number;
  daysTouched: number;
  failedWeeks?: number;
  error?: { error: string; code?: string; suggestion?: string; detail?: string; model?: string };
}

export default function MonthlyCurrentAffairsPage() {
  const { showError } = useErrorPopup();
  const important = useImportantPoints();
  const currentMonth = monthKeyOf(istDateString());

  const [pending, setPending] = useState(currentMonth);
  const [data, setData] = useState<MonthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [notice, setNotice] = useState("");
  const [dialogItem, setDialogItem] = useState<MonthItem | null>(null);
  const [reviseItem, setReviseItem] = useState<MonthItem | null>(null);
  const [job, setJob] = useState<GenerateJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shownMonthRef = useRef<string | null>(null);

  const load = useCallback(
    async (month: string) => {
      setLoading(true);
      setNotice("");
      try {
        const res = await fetch(`/api/current-affairs/month?month=${month}`);
        if (!res.ok) {
          showError(await readApiError(res, "Failed to load that month"));
          return;
        }
        const json: MonthData = await res.json();
        setData(json);
        setPending(json.month);
      } catch (err) {
        showError(toAppError(err, "Failed to load that month"));
      } finally {
        setLoading(false);
      }
    },
    [showError]
  );

  useEffect(() => {
    load(currentMonth);
  }, [load, currentMonth]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchJob = useCallback(async (month: string): Promise<GenerateJob | null> => {
    try {
      const res = await fetch(`/api/current-affairs/month/generate?month=${month}`);
      if (!res.ok) return null;
      const json = await res.json();
      return (json.job as GenerateJob | null) ?? null;
    } catch {
      return null;
    }
  }, []);

  const startPolling = useCallback(
    (month: string) => {
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        const j = await fetchJob(month);
        if (!j) return;
        setJob(j);
        if (j.state === "running") return;
        stopPolling();
        if (shownMonthRef.current === month) await load(month);
        if (j.state === "error" && j.error) {
          showError({
            message: j.error.error,
            code: j.error.code,
            suggestion: j.error.suggestion,
            detail: j.error.detail,
            model: j.error.model,
          });
        } else {
          setNotice(
            `Generated ${j.itemsAdded} point${j.itemsAdded === 1 ? "" : "s"} across ${j.daysTouched} day${j.daysTouched === 1 ? "" : "s"}. Review them below, then save as notes.${j.failedWeeks ? ` ${j.failedWeeks} week${j.failedWeeks === 1 ? "" : "s"} could not be generated; click Fill in missing days to retry.` : ""}`
          );
        }
      }, 4000);
    },
    [fetchJob, stopPolling, load, showError]
  );

  const shownMonth = data?.month;
  useEffect(() => {
    shownMonthRef.current = shownMonth ?? null;
    stopPolling();
    setJob(null);
    if (!shownMonth) return;
    let cancelled = false;
    fetchJob(shownMonth).then((j) => {
      if (cancelled || !j) return;
      setJob(j);
      if (j.state === "running") startPolling(shownMonth);
    });
    return () => {
      cancelled = true;
    };
  }, [shownMonth, fetchJob, startPolling, stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  const startGenerate = async () => {
    if (!data) return;
    const model = getStoredModel();
    setNotice("");
    try {
      const res = await fetch("/api/current-affairs/month/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: data.month, model }),
      });
      if (!res.ok) {
        showError(await readApiError(res, "Failed to start generating", model));
        return;
      }
      const json = await res.json();
      setJob(json.job);
      startPolling(data.month);
    } catch (err) {
      showError(toAppError(err, "Failed to start generating", model));
    }
  };

  const running = job?.state === "running";

  const saveNotes = async () => {
    if (!data) return;
    setSaving(true);
    setNotice("");
    try {
      const res = await fetch("/api/current-affairs/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: data.month }),
      });
      if (!res.ok) {
        showError(await readApiError(res, "Failed to save the monthly note"));
        return;
      }
      const result = await res.json();
      setData((prev) =>
        prev
          ? {
              ...prev,
              monthly: { noteId: result.noteId, title: result.title, days: result.days, items: result.items },
              days: prev.days.map((d) => (d.count > 0 ? { ...d, inMonthly: true } : d)),
            }
          : prev
      );
      setNotice(
        result.created
          ? `Saved "${result.title}" with ${result.items} points from ${result.days} day${result.days === 1 ? "" : "s"}.`
          : `Updated "${result.title}" — ${result.days} day${result.days === 1 ? "" : "s"}, ${result.items} points.`
      );
    } catch (err) {
      showError(toAppError(err, "Failed to save the monthly note"));
    } finally {
      setSaving(false);
    }
  };

  const groups = useMemo(() => {
    if (!data) return [];
    return CA_CATEGORIES.filter((c) => filter === "all" || c.division === filter)
      .map((c) => ({ category: c, items: data.items.filter((i) => i.category === c.id) }))
      .filter((g) => g.items.length > 0);
  }, [data, filter]);

  const counts = useMemo(() => {
    const gs = data?.items.filter((i) => i.division === "gs").length ?? 0;
    const st = data?.items.filter((i) => i.division === "static").length ?? 0;
    return { all: gs + st, gs, static: st };
  }, [data]);

  const allSaved = !!data && data.days.length > 0 && data.days.every((d) => d.count === 0 || d.inMonthly);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-4">
        <CalendarRange size={22} className="text-[#1f4e9c]" aria-hidden="true" />
        Current Affairs
      </h1>
      <CurrentAffairsTabs active="monthly" />

      {/* Month picker */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) load(pending);
        }}
        className="bg-white border border-gray-200 rounded-xl p-4 mb-5"
      >
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="month-select" className="text-sm font-medium text-gray-700">
              Select month
            </label>
            <input
              id="month-select"
              type="month"
              value={pending}
              max={currentMonth}
              onChange={(e) => setPending(e.target.value)}
              className="h-10 border border-gray-300 rounded-md px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1f4e9c]"
            />
          </div>
          <Button type="submit" disabled={!pending || loading} loading={loading}>
            OK
          </Button>
        </div>

        {data && data.availableMonths.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <span className="text-xs text-gray-500">Saved months:</span>
            {data.availableMonths.map((m) => (
              <button
                key={m.month}
                type="button"
                onClick={() => load(m.month)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  data.month === m.month
                    ? "bg-[#1f4e9c] text-white border-[#1f4e9c]"
                    : "border-gray-300 text-gray-600 hover:border-[#1f4e9c]"
                }`}
              >
                {m.label} <span className="opacity-70">· {m.days}d</span>
              </button>
            ))}
          </div>
        )}
      </form>

      {notice && (
        <div role="status" className="mb-4 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
          {notice}
        </div>
      )}

      {running && job && (
        <div role="status" className="bg-white border border-[#1f4e9c]/30 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-3">
            <LoadingSpinner size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">
                Generating {data?.monthLabel ?? "this month"} — week {Math.min(job.step + 1, job.totalSteps)} of {job.totalSteps}
              </p>
              <p className="text-xs text-gray-500">
                {job.itemsAdded} point{job.itemsAdded === 1 ? "" : "s"} so far. You can leave this page; it keeps
                running. Days you already saved are left as they are.
              </p>
            </div>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-[#1f4e9c] transition-all"
              style={{ width: `${Math.round((job.step / job.totalSteps) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <CalendarRange size={36} className="mx-auto text-gray-300 mb-3" aria-hidden="true" />
          <p className="font-medium text-gray-700">Nothing saved for {data.monthLabel}</p>
          <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
            Nothing was saved for this month. You can generate it: the app collects that month&apos;s news headlines
            from a news archive, then sorts them into GS topics and Static GK. It can take several minutes.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            <Button onClick={startGenerate} disabled={running}>
              <Wand2 size={14} aria-hidden="true" />
              Generate {data.monthLabel}
            </Button>
            {data.month === currentMonth && (
              <Link href="/current-affairs">
                <Button variant="secondary">Get today&apos;s current affairs</Button>
              </Link>
            )}
          </div>
        </div>
      ) : data ? (
        <>
          {/* Month summary + save */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">{data.monthLabel}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {data.days.length} day{data.days.length === 1 ? "" : "s"} · {data.items.length} points
                {data.monthly && ` · note has ${data.monthly.days} day${data.monthly.days === 1 ? "" : "s"}`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {data.monthly && (
                <Link href={`/notes/${data.monthly.noteId}`}>
                  <Button variant="secondary" size="sm">
                    <BookOpen size={14} aria-hidden="true" />
                    Open note
                  </Button>
                </Link>
              )}
              <Button variant="secondary" size="sm" onClick={startGenerate} disabled={running}>
                <Wand2 size={14} aria-hidden="true" />
                Fill in missing days
              </Button>
              <Button size="sm" onClick={saveNotes} loading={saving}>
                <FilePlus2 size={14} aria-hidden="true" />
                {data.monthly ? (allSaved ? "Re-sync notes" : "Update notes") : "Save as notes"}
              </Button>
            </div>
          </div>

          {/* Days covered */}
          <div className="flex gap-1.5 flex-wrap mb-4" aria-label="Days covered">
            {data.days.map((d) => (
              <Link
                key={d.date}
                href={`/current-affairs?date=${d.date}`}
                className="text-[11px] px-2 py-0.5 rounded border border-gray-200 text-gray-600 hover:border-[#1f4e9c]"
                title={`${d.count} points`}
              >
                {shortDayLabel(d.date)}
                {d.inMonthly && <Check size={9} className="inline ml-0.5 text-green-600" aria-label="In note" />}
              </Link>
            ))}
          </div>

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

          <div className="space-y-4">
            {groups.map(({ category, items }) => (
              <section
                key={category.id}
                aria-labelledby={`mcat-${category.id}`}
                className="bg-white border border-gray-200 rounded-xl p-4"
              >
                <h2 id={`mcat-${category.id}`} className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
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
                    <li key={`${item.date}-${i}`} className="flex gap-2.5">
                      <span className="text-xs font-medium text-[#1f4e9c] bg-[#eef3fb] rounded px-1.5 py-0.5 h-fit flex-shrink-0 mt-0.5">
                        {shortDayLabel(item.date)}
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
                            type="button"
                            onClick={() => important.toggle(item, item.date)}
                            aria-pressed={important.isMarked(item.point)}
                            title={important.isMarked(item.point) ? "Remove from Important" : "Mark as important"}
                            className={`inline-flex items-center gap-1 text-xs font-medium hover:underline ${
                              important.isMarked(item.point) ? "text-amber-600" : "text-gray-500"
                            }`}
                          >
                            <Star size={11} className={important.isMarked(item.point) ? "fill-amber-400 text-amber-500" : ""} aria-hidden="true" />
                            {important.isMarked(item.point) ? "Important" : "Mark important"}
                          </button>
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
        </>
      ) : null}

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
