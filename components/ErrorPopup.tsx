"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, X, ChevronDown, Lightbulb } from "lucide-react";
import { AI_MODELS, DEFAULT_MODEL, MODELS_CHANGED_EVENT, getStoredModel, setStoredModel } from "@/lib/models";
import type { AppError } from "@/lib/client-errors";

const AUTO_DISMISS_MS = 20000;
const MAX_VISIBLE = 3;

const TITLES: Record<string, string> = {
  RATE_LIMITED: "Model rate limit reached",
  RATE_LIMITED_APP: "Too many requests",
  NO_CREDITS: "Not enough credits",
  AUTH: "AI provider refused the request",
  MODEL_NOT_FOUND: "Model not found",
  INVALID_REQUEST: "AI provider rejected the request",
  CONTEXT_TOO_LONG: "Conversation too long for this model",
  EMPTY_RESPONSE: "Model returned an empty answer",
  INCOMPLETE_RESPONSE: "Model's answer was incomplete",
  PROVIDER_UNAVAILABLE: "AI provider is unavailable",
  NETWORK: "Server can't reach the AI provider",
  NETWORK_CLIENT: "Can't reach the server",
  NOT_CONFIGURED: "AI is not configured",
  NO_SOURCES: "Couldn't fetch today's news",
  VOICE_UNSUPPORTED: "Voice input not supported",
  VOICE_DENIED: "Microphone blocked",
  VOICE_NETWORK: "Voice service unreachable",
  VOICE_NO_SPEECH: "No speech detected",
  VOICE_ERROR: "Voice input failed",
};

const SWITCHABLE_CODES = new Set([
  "RATE_LIMITED",
  "NO_CREDITS",
  "MODEL_NOT_FOUND",
  "INVALID_REQUEST",
  "EMPTY_RESPONSE",
  "INCOMPLETE_RESPONSE",
  "PROVIDER_UNAVAILABLE",
  "AUTH",
]);

interface PopupItem extends AppError {
  id: number;
}

interface ErrorPopupContextValue {
  showError: (error: AppError | string) => void;
}

const ErrorPopupContext = createContext<ErrorPopupContextValue>({ showError: () => {} });

export function useErrorPopup(): ErrorPopupContextValue {
  return useContext(ErrorPopupContext);
}

export function ErrorPopupProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<PopupItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const showError = useCallback((error: AppError | string) => {
    const err: AppError = typeof error === "string" ? { message: error } : error;
    setItems((prev) => {
      const withoutDuplicate = prev.filter(
        (i) => !(i.message === err.message && i.code === err.code)
      );
      return [...withoutDuplicate, { ...err, id: nextId.current++ }].slice(-MAX_VISIBLE);
    });
  }, []);

  const value = useMemo(() => ({ showError }), [showError]);

  return (
    <ErrorPopupContext.Provider value={value}>
      {children}
      <div
        className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-[min(26rem,calc(100vw-2rem))] pointer-events-none"
        aria-live="assertive"
      >
        {items.map((item) => (
          <ErrorCard key={item.id} item={item} onClose={() => dismiss(item.id)} />
        ))}
      </div>
    </ErrorPopupContext.Provider>
  );
}

function ErrorCard({ item, onClose }: { item: PopupItem; onClose: () => void }) {
  const [showDetail, setShowDetail] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || showDetail) return;
    const timer = setTimeout(onClose, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [paused, showDetail, onClose]);

  const title = (item.code && TITLES[item.code]) || "Something went wrong";
  const isCustomModel = !!item.model && !AI_MODELS.some((m) => m.id === item.model);
  const canSwitch =
    !!item.code &&
    SWITCHABLE_CODES.has(item.code) &&
    !!item.model &&
    item.model !== DEFAULT_MODEL;
  const showManage = isCustomModel && (item.code === "MODEL_NOT_FOUND" || item.code === "INVALID_REQUEST");

  const switchToDefault = () => {
    if (getStoredModel() !== DEFAULT_MODEL) setStoredModel(DEFAULT_MODEL);
    window.dispatchEvent(new Event(MODELS_CHANGED_EVENT));
    onClose();
  };

  const detailLines = [item.model ? `Model: ${item.model}` : null, item.detail].filter(Boolean);

  return (
    <div
      role="alert"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto bg-white border border-red-200 border-l-4 border-l-red-500 rounded-lg shadow-lg p-4"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-sm text-gray-700 mt-1 break-words">{item.message}</p>

          {item.suggestion && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-blue-800 bg-blue-50 border border-blue-100 rounded-md px-2.5 py-2">
              <Lightbulb size={12} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>{item.suggestion}</span>
            </div>
          )}

          {(canSwitch || showManage) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {canSwitch && (
                <button
                  onClick={switchToDefault}
                  className="text-xs font-medium text-white bg-[#1f4e9c] hover:bg-[#173d7d] rounded-md px-3 py-1.5 transition-colors"
                >
                  Switch to default model
                </button>
              )}
              {showManage && (
                <Link
                  href="/account#models"
                  onClick={onClose}
                  className="text-xs font-medium text-[#1f4e9c] border border-[#1f4e9c] hover:bg-[#eef3fb] rounded-md px-3 py-1.5 transition-colors"
                >
                  Manage models
                </Link>
              )}
            </div>
          )}

          {detailLines.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowDetail((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700"
                aria-expanded={showDetail}
              >
                <ChevronDown
                  size={11}
                  className={`transition-transform ${showDetail ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
                Technical details
              </button>
              {showDetail && (
                <pre className="mt-1.5 text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded-md p-2 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                  {detailLines.join("\n")}
                </pre>
              )}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          aria-label="Dismiss error"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export default ErrorPopupProvider;
