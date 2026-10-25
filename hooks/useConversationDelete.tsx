"use client";

import { useCallback, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface Target {
  id: string;
  title: string;
}

export interface DeletedChatInfo {
  topicId?: string | null;
  topic?: string | null;
  subject?: string | null;
  section?: string | null;
}

/**
 * Asks before deleting a conversation. Render `dialog` once in the component and call
 * `requestDelete(conversation)` from a trash button.
 */
export function useConversationDelete(onDeleted?: (id: string, info: DeletedChatInfo) => void): {
  requestDelete: (target: Target) => void;
  dialog: ReactNode;
} {
  const [target, setTarget] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = useCallback(() => {
    setTarget(null);
    setError("");
  }, []);

  const confirm = useCallback(async () => {
    if (!target) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/conversations/${target.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not delete the conversation.");
      }
      const info: DeletedChatInfo = await res.json().catch(() => ({}));
      const id = target.id;
      setTarget(null);
      window.dispatchEvent(new Event("conversations:refresh"));
      onDeleted?.(id, info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the conversation.");
    } finally {
      setBusy(false);
    }
  }, [target, onDeleted]);

  const dialog = (
    <ConfirmDialog
      open={target !== null}
      title="Delete this conversation?"
      message={
        error ||
        `"${target?.title ?? ""}" and all its messages will be removed. Notes you already saved from it are kept. This cannot be undone.`
      }
      confirmLabel="Delete"
      loading={busy}
      onConfirm={confirm}
      onCancel={close}
    />
  );

  return { requestDelete: setTarget, dialog };
}
