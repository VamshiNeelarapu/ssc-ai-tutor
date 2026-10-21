"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Edit3,
  Trash2,
  Brain,
  ArrowLeft,
  ChevronDown,
  Download,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { RevisionBadge } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { ErrorState } from "@/components/ui/ErrorState";
import { NoteViewer } from "@/components/NoteViewer";
import type { NoteDetail } from "@/hooks/useNotes";

const REVISION_STATUS_OPTIONS = [
  { value: "not_started", label: "Not Started" },
  { value: "learning", label: "Learning" },
  { value: "needs_revision", label: "Needs Revision" },
  { value: "revised", label: "Revised" },
];

export default function NoteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [syllabusMap, setSyllabusMap] = useState<
    Record<string, { name: string; parentName?: string }>
  >({});
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pdfDropdownOpen, setPdfDropdownOpen] = useState(false);
  const pdfDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pdfDropdownRef.current && !pdfDropdownRef.current.contains(e.target as Node)) {
        setPdfDropdownOpen(false);
      }
    }
    if (pdfDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pdfDropdownOpen]);

  useEffect(() => {
    const fetchNote = async () => {
      try {
        const [noteRes, syllabusRes] = await Promise.all([
          fetch(`/api/notes/${params.id}`),
          fetch("/api/syllabus"),
        ]);

        if (!noteRes.ok) {
          if (noteRes.status === 404) setError("Note not found");
          else setError("Failed to load note");
          return;
        }

        const noteData = await noteRes.json();
        setNote(noteData);

        if (syllabusRes.ok) {
          const syllabusData = await syllabusRes.json();
          const map: Record<string, { name: string; parentName?: string }> = {};
          if (Array.isArray(syllabusData)) {
            syllabusData.forEach((subject: { id: string; name: string; children: Array<{id: string; name: string}> }) => {
              map[subject.id] = { name: subject.name };
              subject.children?.forEach((section) => {
                map[section.id] = {
                  name: section.name,
                  parentName: subject.name,
                };
              });
            });
          }
          setSyllabusMap(map);
        }
      } catch {
        setError("Failed to load note");
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [params.id]);

  const handleStatusChange = async (
    status: "not_started" | "learning" | "needs_revision" | "revised"
  ) => {
    if (!note) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/notes/${params.id}/revision-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionStatus: status }),
      });
      if (res.ok) {
        const data = await res.json();
        setNote((prev) =>
          prev ? { ...prev, revisionStatus: data.revisionStatus } : null
        );
      }
    } catch {
      // Silently fail
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${note?.title}"? This action cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/notes/${params.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/notes");
      } else {
        alert("Failed to delete note");
      }
    } catch {
      alert("Failed to delete note");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="p-6">
        <ErrorState
          message={error || "Note not found"}
          onRetry={() => router.refresh()}
        />
      </div>
    );
  }

  const subjectName = note.subjectId ? syllabusMap[note.subjectId]?.name : null;
  const sectionName = note.sectionId ? syllabusMap[note.sectionId]?.name : null;

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Back */}
      <Link
        href="/notes"
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to notes
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">{note.title}</h1>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href={`/quiz/${params.id}`}>
              <Button variant="secondary" size="sm">
                <Brain size={14} aria-hidden="true" />
                Quiz Me
              </Button>
            </Link>
            <Link href={`/notes/${params.id}/edit`}>
              <Button variant="secondary" size="sm">
                <Edit3 size={14} aria-hidden="true" />
                Edit
              </Button>
            </Link>

            {/* Download PDF dropdown */}
            <div className="relative" ref={pdfDropdownRef}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPdfDropdownOpen((o) => !o)}
              >
                <Download size={14} aria-hidden="true" />
                Download PDF
                <ChevronDown size={12} aria-hidden="true" />
              </Button>
              {pdfDropdownOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      window.open(`/notes/${params.id}/print?mode=full`, "_blank");
                      setPdfDropdownOpen(false);
                    }}
                  >
                    Full Notes PDF
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      window.open(`/notes/${params.id}/print?mode=revision`, "_blank");
                      setPdfDropdownOpen(false);
                    }}
                  >
                    Revision Sheet PDF
                  </button>
                </div>
              )}
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              loading={deleting}
            >
              <Trash2 size={14} aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {(subjectName || sectionName) && (
            <p className="text-sm text-gray-500">
              📁 {[subjectName, sectionName].filter(Boolean).join(" > ")}
            </p>
          )}

          {/* Revision status selector */}
          <div className="flex items-center gap-2">
            <RevisionBadge status={note.revisionStatus} />
            <div className="relative">
              <select
                value={note.revisionStatus}
                onChange={(e) =>
                  handleStatusChange(
                    e.target.value as typeof note.revisionStatus
                  )
                }
                disabled={updatingStatus}
                className="text-xs border border-gray-300 rounded-md pl-2 pr-6 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                aria-label="Change revision status"
              >
                {REVISION_STATUS_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                aria-hidden="true"
              />
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Updated {new Date(note.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Note content */}
      <NoteViewer note={note} />
    </div>
  );
}
