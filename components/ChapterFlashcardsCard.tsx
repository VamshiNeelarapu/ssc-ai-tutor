"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Layers, Lock, Sparkles } from "lucide-react";
import Button from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useErrorPopup } from "@/components/ErrorPopup";
import { readApiError, toAppError } from "@/lib/client-errors";
import { getStoredModel } from "@/lib/models";
import { copyText } from "@/lib/clipboard";
import { flashcardsToText, type Flashcard } from "@/lib/flashcards";

interface FlashcardStatus {
  totalTopics: number;
  coveredTopics: number;
  ready: boolean;
  set: { id: string; title: string; cards: Flashcard[] } | null;
}

// Pass a sectionId for the chapter set, or a topicId for a single topic
export function ChapterFlashcardsCard({ sectionId, topicId }: { sectionId?: string; topicId?: string }) {
  const isTopic = Boolean(topicId);
  const query = isTopic ? `topicId=${topicId}` : `sectionId=${sectionId}`;
  const viewHref = isTopic ? `/notes/flashcards/topic/${topicId}` : `/notes/flashcards/${sectionId}`;
  const router = useRouter();
  const { showError } = useErrorPopup();
  const [status, setStatus] = useState<FlashcardStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes/flashcards?${query}`);
      if (res.ok) setStatus(await res.json());
    } catch {
      /* the card simply stays hidden */
    }
  }, [query]);

  useEffect(() => {
    setStatus(null);
    load();
  }, [load]);

  const generate = async () => {
    setConfirmRegenerate(false);
    setGenerating(true);
    const model = getStoredModel();
    try {
      const res = await fetch("/api/notes/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isTopic ? { topicId, model } : { sectionId, model }),
      });
      if (!res.ok) {
        showError(await readApiError(res, "Could not make the flashcards", model));
        return;
      }
      router.push(viewHref);
    } catch (err) {
      showError(toAppError(err, "Could not make the flashcards", model));
    } finally {
      setGenerating(false);
      load();
    }
  };

  const copyAll = async () => {
    if (!status?.set) return;
    const ok = await copyText(flashcardsToText(status.set.title, status.set.cards));
    setCopied(ok ? "done" : "failed");
    setTimeout(() => setCopied(null), 2500);
  };

  if (!status || status.totalTopics === 0) return null;

  const hasSet = Boolean(status.set);

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#e3ebf7]">
          {status.ready ? (
            <Layers size={18} className="text-[#1f4e9c]" aria-hidden="true" />
          ) : (
            <Lock size={16} className="text-gray-400" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-gray-900">Recall &amp; flashcards</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {status.ready
              ? isTopic
                ? "20 to 30 cards on the points SSC asks again and again, picked from your notes on this topic. Test yourself, then copy them out."
                : "At least 10 cards for every topic, on the points SSC asks again and again, picked from your own topic notes. Test yourself, then copy them out."
              : isTopic
              ? "Make a note for this topic first. Flashcards are built from your own notes."
              : `Unlocks when every topic has a note. ${status.coveredTopics} of ${status.totalTopics} topics done.`}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {hasSet && (
              <Link href={viewHref}>
                <Button size="sm" variant="secondary">
                  Open flashcards ({status.set!.cards.length})
                </Button>
              </Link>
            )}
            {hasSet && (
              <Button size="sm" variant="secondary" onClick={copyAll}>
                {copied === "done" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                {copied === "done" ? "Copied" : copied === "failed" ? "Copy blocked" : "Copy all"}
              </Button>
            )}
            <Button
              size="sm"
              disabled={!status.ready || generating}
              loading={generating}
              onClick={() => (hasSet ? setConfirmRegenerate(true) : generate())}
              title={status.ready ? undefined : isTopic ? "Make a note for this topic first" : "Make notes for every topic first"}
            >
              <Sparkles size={14} aria-hidden="true" />
              {generating ? "Making flashcards..." : hasSet ? "Regenerate flashcards" : "Make flashcards"}
            </Button>
            {generating && (
              <span className="text-xs text-gray-400">
                {isTopic ? "This can take a minute." : "This can take a few minutes, as every topic is done separately."}
              </span>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRegenerate}
        title="Regenerate flashcards?"
        message="The current set of flashcards will be replaced with a new one."
        confirmLabel="Regenerate"
        onConfirm={generate}
        onCancel={() => setConfirmRegenerate(false)}
      />
    </div>
  );
}

export default ChapterFlashcardsCard;
