"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useErrorPopup } from "@/components/ErrorPopup";
import { readApiError, toAppError } from "@/lib/client-errors";
import type { CADivision } from "@/lib/current-affairs-config";

export interface ImportantPoint {
  id: string;
  date: string;
  point: string;
  category: string;
  division: CADivision;
  staticLink?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourcePublisher?: string;
  background?: string;
  createdAt: string;
}

export interface MarkableItem {
  point: string;
  category: string;
  division: CADivision;
  staticLink?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourcePublisher?: string;
}

export function useImportantPoints() {
  const { showError } = useErrorPopup();
  const [points, setPoints] = useState<ImportantPoint[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/current-affairs/important");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.points)) setPoints(data.points);
    } catch {
      // keep what we have
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const markedIds = useMemo(() => new Map(points.map((p) => [p.point, p.id])), [points]);
  const isMarked = useCallback((point: string) => markedIds.has(point), [markedIds]);

  const remove = useCallback(
    async (id: string) => {
      const previous = points;
      setPoints((prev) => prev.filter((p) => p.id !== id));
      try {
        const res = await fetch(`/api/current-affairs/important?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) {
          setPoints(previous);
          showError(await readApiError(res, "Failed to remove the point"));
        }
      } catch (err) {
        setPoints(previous);
        showError(toAppError(err, "Failed to remove the point"));
      }
    },
    [points, showError]
  );

  const toggle = useCallback(
    async (item: MarkableItem, date: string) => {
      const existing = markedIds.get(item.point);
      if (existing) {
        await remove(existing);
        return;
      }
      try {
        const res = await fetch("/api/current-affairs/important", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            point: item.point,
            category: item.category,
            division: item.division,
            staticLink: item.staticLink,
            sourceTitle: item.sourceTitle,
            sourceUrl: item.sourceUrl,
            sourcePublisher: item.sourcePublisher,
          }),
        });
        if (!res.ok) {
          showError(await readApiError(res, "Failed to mark the point as important"));
          return;
        }
        const saved: ImportantPoint = await res.json();
        setPoints((prev) => [saved, ...prev.filter((p) => p.id !== saved.id)]);
      } catch (err) {
        showError(toAppError(err, "Failed to mark the point as important"));
      }
    },
    [markedIds, remove, showError]
  );

  return { points, loaded, isMarked, toggle, remove, reload };
}
