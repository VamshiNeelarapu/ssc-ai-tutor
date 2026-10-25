"use client";

import { FlashcardViewer } from "@/components/FlashcardViewer";

export default function TopicFlashcardsPage({ params }: { params: { topicId: string } }) {
  return <FlashcardViewer topicId={params.topicId} />;
}
