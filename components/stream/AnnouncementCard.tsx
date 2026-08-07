"use client";

import { useState } from "react";
import {
  Edit3,
  MessageSquare,
  MoreVertical,
  Pin,
  Send,
  Trash2,
} from "lucide-react";

import type {
  Announcement,
  AnnouncementComment,
} from "@/lib/types";

import AttachmentChip from "@/components/stream/AttachmentChip";
import { formatRelativeTime } from "@/lib/format";

function initials(name: string | null | undefined, email: string) {
  const source = name?.trim() || email;

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

interface AnnouncementCardProps {
  announcement: Announcement;
  isFaculty: boolean;
  currentUserId: string | null;

  onEdit: (id: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTogglePin: (id: string, isPinned: boolean) => Promise<void>;
  onAddComment: (
    announcementId: string,
    content: string
  ) => Promise<void>;
  onDeleteComment: (
    commentId: string,
    announcementId: string
  ) => Promise<void>;
}

export default function AnnouncementCard({
  announcement,
  isFaculty,
  currentUserId,
  onEdit,
  onDelete,
  onTogglePin,
  onAddComment,
  onDeleteComment,
}: AnnouncementCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(announcement.content);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentValue, setCommentValue] = useState("");
  const [posting, setPosting] = useState(false);

  const author = announcement.author;
  const comments = announcement.comments ?? [];

  async function handleSaveEdit() {
    if (!editValue.trim()) return;

    await onEdit(announcement.id, editValue.trim());

    setEditing(false);
  }

  async function handlePostComment() {
    if (!commentValue.trim()) return;

    setPosting(true);

    try {
      await onAddComment(
        announcement.id,
        commentValue.trim()
      );

      setCommentValue("");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
          {initials(author?.full_name, author?.email ?? "?")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {author?.full_name || author?.email || "Unknown"}
            </p>

            {announcement.is_pinned && (
              <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-900/30">
                <Pin size={10} />
                Pinned
              </span>
            )}
          </div>

          <p className="text-xs text-gray-400">
            {formatRelativeTime(announcement.created_at)}
          </p>
        </div>

        {isFaculty && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <MoreVertical size={16} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                <button
                  onClick={() => {
                    onTogglePin(
                      announcement.id,
                      !announcement.is_pinned
                    );
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Pin size={13} />
                  {announcement.is_pinned ? "Unpin" : "Pin"}
                </button>

                <button
                  onClick={() => {
                    setEditing(true);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Edit3 size={13} />
                  Edit
                </button>

                <button
                  onClick={() => {
                    onDelete(announcement.id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3">
        {editing ? (
          <div className="space-y-2">
            <textarea
              rows={3}
              value={editValue}
              onChange={(e) =>
                setEditValue(e.target.value)
              }
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditing(false);
                  setEditValue(announcement.content);
                }}
                className="rounded-full px-3 py-1.5 text-xs hover:bg-gray-100"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveEdit}
                className="rounded-full bg-blue-600 px-4 py-1.5 text-xs text-white"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {announcement.content}
          </p>
        )}
      </div>

      {(announcement.attachments?.length ?? 0) > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {announcement.attachments!.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              attachment={attachment}
            />
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-700">
        <button
          onClick={() => setCommentsOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500"
        >
          <MessageSquare size={14} />
          {comments.length} comment
          {comments.length === 1 ? "" : "s"}
        </button>

        {commentsOpen && (
          <div className="mt-3 space-y-3">
            {comments.map((comment: AnnouncementComment) => (
              <div
                key={comment.id}
                className="flex items-start gap-2.5"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold">
                  {initials(
                    comment.author?.full_name,
                    comment.author?.email ?? "?"
                  )}
                </span>

                <div className="flex-1 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">
                      {comment.author?.full_name ||
                        comment.author?.email}
                    </p>

                    {(currentUserId === comment.author_id ||
                      isFaculty) && (
                      <button
                        onClick={() =>
                          onDeleteComment(
                            comment.id,
                            announcement.id
                          )
                        }
                        className="text-[10px] text-red-500"
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  <p className="mt-1 text-xs">
                    {comment.content}
                  </p>
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <input
                value={commentValue}
                onChange={(e) =>
                  setCommentValue(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handlePostComment();
                  }
                }}
                placeholder="Add a class comment..."
                className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />

              <button
                onClick={handlePostComment}
                disabled={
                  posting || !commentValue.trim()
                }
                className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-40"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}