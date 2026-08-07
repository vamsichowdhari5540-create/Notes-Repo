"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Card from "@/components/Card";
import type { NoteWithMeta } from "@/lib/types";

type NoteCardProps = {
  note: NoteWithMeta;
  onToggleUpvote?: (noteId: string) => void;
  onView?: (noteId: string) => void;
  isOwner?: boolean;
  onDelete?: (noteId: string) => void;
};

export default function NoteCard({
  note,
  onToggleUpvote,
  onView,
  isOwner = false,
  onDelete,
}: NoteCardProps) {
  const [downloading, setDownloading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleDownload() {
    onView?.(note.id);
    setDownloading(true);
    try {
      const response = await fetch(note.file_url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const ext = note.file_type ? `.${note.file_type}` : "";
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${note.title}${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card hover className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
            {note.title}
          </h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            by {note.uploader_name}
          </p>
        </div>

        <motion.button
          type="button"
          onClick={() => onToggleUpvote?.(note.id)}
          disabled={!onToggleUpvote}
          aria-pressed={note.upvoted_by_me}
          aria-label="Rating"
          whileTap={onToggleUpvote ? { scale: 0.9 } : undefined}
          className={`flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
            note.upvoted_by_me
              ? "bg-amber-400/15 text-amber-500"
              : "bg-slate-900/5 text-slate-600 dark:bg-white/10 dark:text-slate-300"
          } ${onToggleUpvote ? "hover:bg-amber-400/20" : "cursor-default"}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={note.upvoted_by_me ? "starred" : "unstarred"}
              initial={{ scale: 0.6, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 22, mass: 0.6 }}
            >
              {note.upvoted_by_me ? "★" : "☆"}
            </motion.span>
          </AnimatePresence>
          <motion.span
            key={note.upvote_count}
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            {note.upvote_count}
          </motion.span>
        </motion.button>
      </div>

      {note.description && (
        <p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
          {note.description}
        </p>
      )}

      {note.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {note.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded-full bg-slate-900/5 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        {note.file_type === "pdf" && (
          <Link
            href={`/notes/${note.id}/flipbook`}
            onClick={() => onView?.(note.id)}
            className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400"
          >
            View in 3D
          </Link>
        )}
        <a
          href={note.file_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onView?.(note.id)}
          className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400"
        >
          View
        </a>
        <motion.button
          type="button"
          whileTap={{ scale: 0.95 }}
          onClick={handleDownload}
          disabled={downloading}
          className="text-sm font-medium text-amber-600 hover:text-amber-700 disabled:opacity-60 dark:text-amber-400"
        >
          {downloading ? "Downloading…" : "Download"}
        </motion.button>

        {isOwner && (
          <>
            <Link
              href={`/notes/${note.id}/edit`}
              className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Edit
            </Link>

            {confirmingDelete ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-slate-500 dark:text-slate-400">Delete?</span>
                <button
                  type="button"
                  onClick={() => onDelete?.(note.id)}
                  className="font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
              >
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
