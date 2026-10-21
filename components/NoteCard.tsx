"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { RevisionBadge } from "./ui/Badge";
import { FileText, Clock } from "lucide-react";
import type { Note } from "@/hooks/useNotes";
import { examBadgeClass, examLabel } from "@/lib/exam";

interface NoteCardProps {
  note: Note;
  subjectName?: string;
  sectionName?: string;
  onDelete?: (id: string) => void;
}

export function NoteCard({ note, subjectName, sectionName, onDelete }: NoteCardProps) {
  const updatedAt = new Date(note.updatedAt);
  const timeAgo = getTimeAgo(updatedAt);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/notes/${note.id}`}
          className="flex-1 min-w-0 group-hover:text-blue-600 transition-colors"
        >
          <div className="flex items-start gap-2">
            <FileText
              size={16}
              className="text-gray-400 mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h3 className="font-medium text-gray-900 truncate group-hover:text-blue-600">
                {note.title}
              </h3>
              {(subjectName || sectionName) && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {[subjectName, sectionName].filter(Boolean).join(" > ")}
                </p>
              )}
            </div>
          </div>
        </Link>

        <RevisionBadge status={note.revisionStatus} />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {note.examRelevance.map((rel) => (
            <span
              key={rel}
              className={clsx(
                "text-xs px-1.5 py-0.5 rounded font-medium",
                examBadgeClass(rel)
              )}
            >
              {examLabel(rel)}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock size={12} aria-hidden="true" />
            {timeAgo}
          </span>

          {onDelete && (
            <button
              onClick={(e) => {
                e.preventDefault();
                if (confirm(`Delete "${note.title}"?`)) {
                  onDelete(note.id);
                }
              }}
              className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Delete note: ${note.title}`}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default NoteCard;
