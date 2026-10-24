"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, RefreshCw, MessageSquare } from "lucide-react";
import Button from "@/components/ui/Button";
import { BackgroundMarkdown } from "@/components/BackgroundMarkdown";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { useErrorPopup } from "@/components/ErrorPopup";
import { readApiError, toAppError } from "@/lib/client-errors";
import { getStoredModel } from "@/lib/models";

interface CurrentAffairsPointDialogProps {
  point: string | null;
  staticLink?: string;
  onClose: () => void;
}

function chatHref(point: string): string {
  const hint = `Explain this current affairs point for SSC CGL, with the background and the static GK behind it: "${point}"`;
  return `/chat?hint=${encodeURIComponent(hint)}&subject=${encodeURIComponent("General Awareness")}`;
}

export function CurrentAffairsPointDialog({ point, staticLink, onClose }: CurrentAffairsPointDialogProps) {
  const { showError } = useErrorPopup();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(
    async (regenerate: boolean) => {
      if (!point) return;
      const model = getStoredModel();
      setLoading(true);
      try {
        const res = await fetch("/api/current-affairs/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ point, staticLink, regenerate, model }),
        });
        if (!res.ok) {
          showError(await readApiError(res, "Failed to load the background", model));
          return;
        }
        const data = await res.json();
        setContent(data.content);
      } catch (err) {
        showError(toAppError(err, "Failed to load the background", model));
      } finally {
        setLoading(false);
      }
    },
    [point, staticLink, showError]
  );

  useEffect(() => {
    if (!point) return;
    setContent("");
    load(false);
    closeRef.current?.focus();
  }, [point, load]);

  useEffect(() => {
    if (!point) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [point, onClose]);

  if (!point) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ca-dialog-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <h2 id="ca-dialog-title" className="text-xs font-semibold uppercase tracking-wider text-[#1f4e9c]">
              Background &amp; past details
            </h2>
            <p className="text-sm font-medium text-gray-900 mt-1">{point}</p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && !content ? (
            <div className="flex flex-col items-center py-10 gap-3 text-sm text-gray-500">
              <LoadingSpinner size="lg" />
              Gathering the background…
            </div>
          ) : content ? (
            <div className="text-sm text-gray-800 leading-relaxed">
              <BackgroundMarkdown content={content} />
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-4">
                Written by AI from general knowledge. It cannot see today&apos;s news, so check dates and figures
                against the source link before relying on them.
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-gray-200">
          <Link
            href={chatHref(point)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#1f4e9c]"
          >
            <MessageSquare size={12} aria-hidden="true" />
            Continue in chat
          </Link>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => load(true)} loading={loading && !!content} disabled={loading}>
              <RefreshCw size={14} aria-hidden="true" />
              Regenerate
            </Button>
            <Button size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CurrentAffairsPointDialog;
