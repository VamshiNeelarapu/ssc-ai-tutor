"use client";

import { useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import {
  ChevronRight,
  ChevronDown,
  BookOpen,
  Folder,
  FolderOpen,
  FileText,
  CircleDot,
  RotateCcw,
  CheckCircle2,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react";

export interface SyllabusTreeNode {
  id: string;
  name: string;
  slug: string;
  nodeType: "subject" | "section" | "topic";
  order: number;
  description?: string;
  children: SyllabusTreeNode[];
}

// Which child type each node can create
const CHILD_TYPE: Record<string, "section" | "topic" | undefined> = {
  subject: "section",
  section: "topic",
};

// Notes made -> Learning -> Needs revision -> Revised. Topics without a note show nothing.
const STATUS_INDICATORS: Record<string, { label: string; Icon: typeof FileText; className: string }> = {
  not_started: { label: "Notes made", Icon: FileText, className: "text-slate-300" },
  learning: { label: "Learning", Icon: CircleDot, className: "text-sky-300" },
  needs_revision: { label: "Needs revision", Icon: RotateCcw, className: "text-amber-400" },
  revised: { label: "Revised", Icon: CheckCircle2, className: "text-green-400" },
};

function StatusIndicator({ status }: { status: string }) {
  const entry = STATUS_INDICATORS[status];
  if (!entry) return null;
  const { Icon, label, className } = entry;
  return (
    <span className={clsx("flex-shrink-0", className)} title={label}>
      <Icon size={12} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

interface TreeNodeProps {
  node: SyllabusTreeNode;
  depth?: number;
  activeId?: string;
  onNodeSelect?: (node: SyllabusTreeNode) => void;
  editable?: boolean;
  onMutate?: () => void;
  topicStatus?: Record<string, string>;
  chatStarted?: Record<string, boolean>;
}

function TreeNode({ node, depth = 0, activeId, onNodeSelect, editable, onMutate, topicStatus, chatStarted }: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const isActive = node.id === activeId;
  const hasActiveChild = hasChildren && node.children.some((c) => c.id === activeId);

  const [expanded, setExpanded] = useState(depth === 0 || hasActiveChild);
  const [hovered, setHovered] = useState(false);
  const [editMode, setEditMode] = useState<"rename" | "add" | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const childType = CHILD_TYPE[node.nodeType];

  // Share of a chapter's topics with no chat started yet (hidden until chat data has loaded)
  const sectionTopics = node.nodeType === "section" ? node.children.filter((c) => c.nodeType === "topic") : [];
  const notStartedPct =
    chatStarted && sectionTopics.length > 0
      ? Math.round((sectionTopics.filter((t) => !chatStarted[t.id]).length / sectionTopics.length) * 100)
      : null;

  const Icon =
    node.nodeType === "subject"
      ? expanded
        ? FolderOpen
        : Folder
      : node.nodeType === "section"
      ? BookOpen
      : FileText;

  const handleRowClick = () => {
    if (editMode) return;
    if (hasChildren) setExpanded((e) => !e);
    onNodeSelect?.(node);
  };

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditMode("rename");
    setEditValue(node.name);
    setDeleteConfirm(false);
    setTimeout(() => { inputRef.current?.select(); }, 40);
  };

  const startAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditMode("add");
    setEditValue("");
    setExpanded(true);
    setTimeout(() => { inputRef.current?.focus(); }, 40);
  };

  const cancelEdit = () => {
    setEditMode(null);
    setEditValue("");
    setDeleteConfirm(false);
  };

  const saveRename = async () => {
    const name = editValue.trim();
    if (!name || name === node.name) { cancelEdit(); return; }
    setSaving(true);
    try {
      await fetch(`/api/syllabus/${node.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      onMutate?.();
    } finally {
      setSaving(false);
      cancelEdit();
    }
  };

  const saveAdd = async () => {
    const name = editValue.trim();
    if (!name || !childType) { cancelEdit(); return; }
    setSaving(true);
    try {
      await fetch("/api/syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: node.id, nodeType: childType }),
      });
      onMutate?.();
    } finally {
      setSaving(false);
      cancelEdit();
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setSaving(true);
    try {
      await fetch(`/api/syllabus/${node.id}`, { method: "DELETE" });
      onMutate?.();
    } finally {
      setSaving(false);
      cancelEdit();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (editMode === "rename") saveRename();
      else if (editMode === "add") saveAdd();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  };

  const pl = `${6 + depth * 16}px`;

  return (
    <li>
      {/* Rename row */}
      {editMode === "rename" ? (
        <div>
          <div
            className="flex items-center gap-1 py-1 rounded-r-md border-l-2 border-[#f5a03a] bg-[#173063]"
            style={{ paddingLeft: pl, paddingRight: "6px" }}
          >
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-[#0a1b38] text-[#e9effa] text-xs rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#f5a03a] min-w-0"
              disabled={saving}
              autoFocus
            />
            <button
              onClick={saveRename}
              disabled={saving || !editValue.trim()}
              className="text-green-400 hover:text-green-300 disabled:opacity-40 flex-shrink-0"
              title="Save"
            >
              <Check size={12} />
            </button>
            <button
              onClick={handleDelete}
              className={clsx(
                "flex-shrink-0 transition-colors",
                deleteConfirm ? "text-red-400" : "text-[#7088b3] hover:text-red-400"
              )}
              title={deleteConfirm ? "Confirm delete" : "Delete"}
            >
              <Trash2 size={12} />
            </button>
            <button
              onClick={cancelEdit}
              className="text-[#7088b3] hover:text-[#e9effa] flex-shrink-0"
              title="Cancel"
            >
              <X size={12} />
            </button>
          </div>
          {deleteConfirm && (
            <div
              className="flex items-center gap-2 py-1 bg-red-950 border-l-2 border-red-500 text-xs text-red-300"
              style={{ paddingLeft: pl, paddingRight: "6px" }}
            >
              <span className="truncate">Delete "{node.name}"?</span>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="text-red-300 hover:text-white font-semibold flex-shrink-0"
              >
                {saving ? "…" : "Yes"}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="text-[#a9bde0] hover:text-white flex-shrink-0"
              >
                No
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Normal row */
        <div
          onMouseEnter={() => editable && setHovered(true)}
          onMouseLeave={() => editable && setHovered(false)}
        >
          <button
            onClick={handleRowClick}
            className={clsx(
              "w-full flex items-center gap-2 py-1.5 rounded-r-md text-sm text-left transition-colors",
              isActive
                ? "border-l-2 border-[#f5a03a] bg-[#1d3c78] text-[#ffd9a6]"
                : "border-l-2 border-transparent hover:bg-[#173063] text-[#8aa3cf] hover:text-[#e9effa]"
            )}
            style={{ paddingLeft: pl, paddingRight: "8px" }}
            title={node.name}
            aria-expanded={hasChildren ? expanded : undefined}
            aria-current={isActive ? "page" : undefined}
          >
            {hasChildren ? (
              expanded ? (
                <ChevronDown size={12} className="flex-shrink-0 text-[#7088b3]" aria-hidden="true" />
              ) : (
                <ChevronRight size={12} className="flex-shrink-0 text-[#7088b3]" aria-hidden="true" />
              )
            ) : (
              <span className="w-3 flex-shrink-0" aria-hidden="true" />
            )}
            <Icon
              size={14}
              className={clsx(
                "flex-shrink-0",
                isActive ? "text-[#f5a03a]" : node.nodeType === "subject" ? "text-[#f5a03a]" : "text-[#8aa3cf]"
              )}
              aria-hidden="true"
            />
            <span className="truncate flex-1">{node.name}</span>
            {node.nodeType === "topic" && topicStatus?.[node.id] && (
              <StatusIndicator status={topicStatus[node.id]} />
            )}
            {notStartedPct !== null && (
              <span
                className="flex-shrink-0 text-[11px] tabular-nums text-[#7088b3]"
                title={`${notStartedPct}% of topics have no chat yet`}
              >
                {notStartedPct}%
              </span>
            )}

            {/* Hover edit controls */}
            {editable && hovered && (
              <span
                className="flex items-center gap-0.5 flex-shrink-0 ml-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {childType && (
                  <button
                    onClick={startAdd}
                    className="p-0.5 text-[#7088b3] hover:text-[#f5a03a] transition-colors rounded"
                    title={`Add ${childType}`}
                  >
                    <Plus size={11} />
                  </button>
                )}
                <button
                  onClick={startRename}
                  className="p-0.5 text-[#7088b3] hover:text-amber-400 transition-colors rounded"
                  title="Rename / delete"
                >
                  <Pencil size={11} />
                </button>
              </span>
            )}
          </button>
        </div>
      )}

      {/* Children + inline add input */}
      {(hasChildren || editMode === "add") && expanded && (
        <ul className="mt-0.5" role="group">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              onNodeSelect={onNodeSelect}
              editable={editable}
              onMutate={onMutate}
              topicStatus={topicStatus}
              chatStarted={chatStarted}
            />
          ))}

          {/* Add child inline input */}
          {editMode === "add" && (
            <li>
              <div
                className="flex items-center gap-1 py-1 rounded-r-md border-l-2 border-[#f5a03a] bg-[#173063]"
                style={{ paddingLeft: `${6 + (depth + 1) * 16}px`, paddingRight: "6px" }}
              >
                <span className="w-3 flex-shrink-0" />
                <FileText size={12} className="text-[#7088b3] flex-shrink-0" aria-hidden="true" />
                <input
                  ref={inputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`New ${childType}…`}
                  className="flex-1 bg-[#0a1b38] text-[#e9effa] text-xs rounded px-1.5 py-0.5 placeholder-[#5a74a3] focus:outline-none focus:ring-1 focus:ring-[#f5a03a] min-w-0"
                  disabled={saving}
                  autoFocus
                />
                <button
                  onClick={saveAdd}
                  disabled={saving || !editValue.trim()}
                  className="text-green-400 hover:text-green-300 disabled:opacity-40 flex-shrink-0"
                  title="Add"
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-[#7088b3] hover:text-[#e9effa] flex-shrink-0"
                  title="Cancel"
                >
                  <X size={12} />
                </button>
              </div>
            </li>
          )}
        </ul>
      )}

    </li>
  );
}

interface SyllabusTreeProps {
  nodes: SyllabusTreeNode[];
  onNodeSelect?: (node: SyllabusTreeNode) => void;
  className?: string;
  editable?: boolean;
  onMutate?: () => void;
  topicStatus?: Record<string, string>;
  chatStarted?: Record<string, boolean>;
}

export function SyllabusTree({ nodes, onNodeSelect, className, editable, onMutate, topicStatus, chatStarted }: SyllabusTreeProps) {
  const searchParams = useSearchParams();
  const activeId = searchParams.get("topicId") || searchParams.get("sectionId") || searchParams.get("subjectId") || "";

  if (nodes.length === 0) {
    return (
      <p className="text-xs text-[#7088b3] px-2 py-4">
        Syllabus not loaded. Connect to MongoDB and refresh.
      </p>
    );
  }

  return (
    <nav aria-label="Syllabus navigation" className={className}>
      <ul className="space-y-0.5" role="tree">
        {nodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            activeId={activeId}
            onNodeSelect={onNodeSelect}
            editable={editable}
            onMutate={onMutate}
            topicStatus={topicStatus}
            chatStarted={chatStarted}
          />
        ))}
      </ul>
    </nav>
  );
}

export default SyllabusTree;
