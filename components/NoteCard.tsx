"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Card from "@/components/Card";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toggleBookmark } from "@/lib/notes";
import type { NoteWithMeta } from "@/lib/types";

const REPORT_REASONS = [
  "Wrong subject or unit",
  "Spam or low quality",
  "Inappropriate content",
  "Copyright or plagiarism",
  "Other",
];

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
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportStatus, setReportStatus] = useState<"idle" | "submitting" | "reported" | "error">(
    "idle"
  );
  const [bookmarked, setBookmarked] = useState(note.bookmarked_by_me);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  async function handleToggleBookmark() {
    if (!user || bookmarkBusy) return;
    const next = !bookmarked;
    setBookmarked(next);
    setBookmarkBusy(true);
    try {
      await toggleBookmark(supabase, note.id, user.id, !next);
    } catch (err) {
      console.error("Toggle bookmark failed:", err);
      setBookmarked(!next);
    } finally {
      setBookmarkBusy(false);
    }
  }

  async function submitReport(reason: string) {
    if (!user) return;
    setReportStatus("submitting");
    const { error } = await supabase
      .from("note_reports")
      .insert({ note_id: note.id, reporter_id: user.id, reason });

    if (error) {
      // Unique violation means they've already reported this note.
      setReportStatus(error.code === "23505" ? "reported" : "error");
    } else {
      setReportStatus("reported");
    }
    setReportOpen(false);
  }

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

        {user && (
          <motion.button
            type="button"
            onClick={handleToggleBookmark}
            disabled={bookmarkBusy}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? "Remove bookmark" : "Save for later"}
            whileTap={{ scale: 0.9 }}
            className={`flex shrink-0 items-center justify-center rounded-lg px-2.5 py-1.5 transition-colors duration-150 ${
              bookmarked
                ? "bg-amber-400/15 text-amber-500"
                : "bg-slate-900/5 text-slate-500 hover:bg-slate-900/10 dark:bg-white/10 dark:text-slate-400 dark:hover:bg-white/20"
            }`}
          >
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill={bookmarked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 3.5A1.5 1.5 0 0 1 6.5 2h7A1.5 1.5 0 0 1 15 3.5v13.34a.5.5 0 0 1-.79.41L10 14.13l-4.21 3.12a.5.5 0 0 1-.79-.41V3.5Z"
              />
            </svg>
          </motion.button>
        )}
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

        {!isOwner && user && (
          <div className="relative">
            {reportStatus === "reported" ? (
              <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
                Reported
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setReportOpen((prev) => !prev)}
                disabled={reportStatus === "submitting"}
                className="text-sm font-medium text-slate-500 hover:text-slate-700 disabled:opacity-60 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Report
              </button>
            )}

            <AnimatePresence>
              {reportOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.12 }}
                  className="absolute bottom-full left-0 z-10 mb-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-900"
                >
                  {REPORT_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => submitReport(reason)}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
                    >
                      {reason}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {reportStatus === "error" && (
          <span className="text-xs text-red-600 dark:text-red-400">
            Couldn&apos;t submit report. Try again.
          </span>
        )}
      </div>
    </Card>
  );
}
