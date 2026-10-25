"use client";

import { FlashcardViewer } from "@/components/FlashcardViewer";

export default function ChapterFlashcardsPage({ params }: { params: { sectionId: string } }) {
  return <FlashcardViewer sectionId={params.sectionId} />;
}
