"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Eye, EyeOff, RotateCcw, Shuffle } from "lucide-react";
import Button from "@/components/ui/Button";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { copyText } from "@/lib/clipboard";
import { flashcardsToText, shuffled, tagLabel, type Flashcard } from "@/lib/flashcards";

interface FlashcardPayload {
  level: "chapter" | "topic";
  name: string;
  sectionId: string;
  sectionName: string;
  ready: boolean;
  set: { title: string; cards: Flashcard[] } | null;
}

// Pass a sectionId for the chapter set, or a topicId for a single topic
export function FlashcardViewer({ sectionId, topicId }: { sectionId?: string; topicId?: string }) {
  const query = topicId ? `topicId=${topicId}` : `sectionId=${sectionId}`;
  const [data, setData] = useState<FlashcardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [topic, setTopic] = useState("");
  const [order, setOrder] = useState<number[] | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);

  useEffect(() => {
    fetch(`/api/notes/flashcards?${query}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not load the flashcards");
        setData(await res.json());
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the flashcards"))
      .finally(() => setLoading(false));
  }, [query]);

  const cards = data?.set?.cards ?? [];
  const topics = useMemo(() => Array.from(new Set(cards.map((c) => c.topic).filter(Boolean))) as string[], [cards]);

  // Cards in the order shown, each with its position in the saved set (used to track which are open)
  const visible = useMemo(() => {
    const indexes = order ?? cards.map((_, i) => i);
    return indexes
      .filter((i) => cards[i] && (!topic || cards[i].topic === topic))
      .map((i) => ({ card: cards[i], index: i }));
  }, [cards, order, topic]);

  const allOpen = visible.length > 0 && visible.every(({ index }) => revealed.has(index));

  const toggle = (index: number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const toggleAll = () =>
    setRevealed((prev) => {
      const next = new Set(prev);
      visible.forEach(({ index }) => (allOpen ? next.delete(index) : next.add(index)));
      return next;
    });

  const shuffle = () => {
    setOrder(shuffled(cards.map((_, i) => i)));
    setRevealed(new Set());
  };

  const resetOrder = () => {
    setOrder(null);
    setRevealed(new Set());
  };

  const copyAll = async () => {
    const title = data?.set?.title ?? "Flashcards";
    const ok = await copyText(
      flashcardsToText(
        topic ? `${title} (${topic})` : title,
        visible.map((v) => v.card)
      )
    );
    setCopied(ok ? "done" : "failed");
    setTimeout(() => setCopied(null), 2500);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <ErrorState message={error || "Could not load the flashcards"} />
      </div>
    );
  }

  const back = (
    <Link
      href={topicId ? `/notes?topicId=${topicId}` : `/notes?sectionId=${sectionId}`}
      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-3"
    >
      <ArrowLeft size={12} aria-hidden="true" /> Back to {data.name}
    </Link>
  );

  if (!data.set) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        {back}
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="font-medium text-gray-700">No flashcards for this {data.level} yet</p>
          <p className="mt-1 text-sm text-gray-500">
            {data.ready
              ? `Use "Make flashcards" on the ${data.level} page.`
              : data.level === "topic"
              ? "Make a note for this topic first."
              : "They unlock once every topic in the chapter has a note."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      {back}
      <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        Recall &amp; flashcards · {visible.length} of {cards.length} card{cards.length === 1 ? "" : "s"}. Try to answer
        before you tap a card.
      </p>

      <div className="mt-4 mb-5 flex flex-wrap items-center gap-2">
        {topics.length > 1 && (
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            aria-label="Filter by topic"
            className="h-8 max-w-[14rem] rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1f4e9c]"
          >
            <option value="">All topics</option>
            {topics.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        <Button size="sm" variant="secondary" onClick={toggleAll} disabled={visible.length === 0}>
          {allOpen ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
          {allOpen ? "Hide answers" : "Show answers"}
        </Button>
        <Button size="sm" variant="secondary" onClick={shuffle}>
          <Shuffle size={14} aria-hidden="true" /> Shuffle
        </Button>
        {order && (
          <Button size="sm" variant="ghost" onClick={resetOrder}>
            <RotateCcw size={14} aria-hidden="true" /> Original order
          </Button>
        )}
        <Button size="sm" onClick={copyAll} disabled={visible.length === 0} className="sm:ml-auto">
          {copied === "done" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied === "done" ? "Copied" : copied === "failed" ? "Copy blocked" : `Copy ${visible.length} cards`}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {visible.map(({ card, index }, position) => {
          const open = revealed.has(index);
          return (
            <button
              key={index}
              type="button"
              onClick={() => toggle(index)}
              aria-expanded={open}
              className={`flex flex-col rounded-xl border p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4e9c] ${
                open ? "border-[#1f4e9c] bg-[#e3ebf7]" : "border-gray-200 bg-white hover:border-[#93a3c2]"
              }`}
            >
              <span className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400">
                <span className="font-medium text-gray-500">{position + 1}</span>
                {topics.length > 1 && card.topic && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{card.topic}</span>}
                {card.tag && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">{tagLabel(card.tag)}</span>}
              </span>
              <span className="text-sm font-medium text-gray-900">{card.front}</span>
              {open ? (
                <span className="mt-3 whitespace-pre-wrap border-t border-[#c5d3ea] pt-3 text-sm text-gray-700">
                  {card.back}
                </span>
              ) : (
                <span className="mt-3 text-xs text-gray-400">Tap to show the answer</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
