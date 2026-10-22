"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DEFAULT_MODEL,
  MODELS_CHANGED_EVENT,
  getStoredModel,
  setStoredModel,
  type CustomModel,
} from "@/lib/models";

export function useCustomModels() {
  const [models, setModels] = useState<CustomModel[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/models");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.models)) setModels(data.models);
    } catch {
      // keep the previous list
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(MODELS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(MODELS_CHANGED_EVENT, refresh);
  }, [refresh]);

  const addModel = useCallback(async (id: string, label?: string): Promise<string | null> => {
    const res = await fetch("/api/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...(label?.trim() ? { label } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || "Failed to add model";
    setModels(data.models);
    window.dispatchEvent(new Event(MODELS_CHANGED_EVENT));
    return null;
  }, []);

  const removeModel = useCallback(async (id: string): Promise<string | null> => {
    const res = await fetch(`/api/models?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error || "Failed to remove model";
    setModels(data.models);
    if (getStoredModel() === id) setStoredModel(DEFAULT_MODEL);
    window.dispatchEvent(new Event(MODELS_CHANGED_EVENT));
    return null;
  }, []);

  return { models, loaded, addModel, removeModel };
}
