"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { deleteNote, getNoteById, replaceNoteFile, updateNote } from "@/lib/notes";
import { storagePathFromPublicUrl } from "@/lib/storage-url";
import {
  ACCEPTED_FILE_EXT,
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE,
  formatFileSize,
} from "@/lib/upload-constraints";
import Card from "@/components/Card";
import Toast from "@/components/Toast";
import { CardSkeleton } from "@/components/Skeleton";
import type { NoteWithMeta, Tag } from "@/lib/types";

export default function EditNotePage() {
  const params = useParams<{ noteId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [note, setNote] = useState<NoteWithMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagQuery, setTagQuery] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replacingFile, setReplacingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [fetchedNote, { data: tagsData }] = await Promise.all([
        getNoteById(supabase, params.noteId),
        supabase.from("tags").select("id, name").order("name"),
      ]);
      setNote(fetchedNote);
      setAllTags(tagsData ?? []);
      if (fetchedNote) {
        setTitle(fetchedNote.title);
        setDescription(fetchedNote.description ?? "");
        setSelectedTags(fetchedNote.tags);
      }
      setLoading(false);
    }
    load();
  }, [params.noteId, supabase]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const tagSuggestions = allTags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(tagQuery.trim().toLowerCase()) &&
      !selectedTags.some((t) => t.id === tag.id)
  );

  function addTag(tag: Tag) {
    setSelectedTags((prev) => [...prev, tag]);
    setTagQuery("");
  }

  function removeTag(tagId: string) {
    setSelectedTags((prev) => prev.filter((t) => t.id !== tagId));
  }

  async function handleSave() {
    if (!note || !user) return;
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateNote(
        supabase,
        note.id,
        user.id,
        { title: title.trim(), description: description.trim() || null },
        selectedTags.map((t) => t.id)
      );
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes.");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!note || !user) return;
    setDeleting(true);
    try {
      await deleteNote(supabase, note.id, user.id);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note.");
      setDeleting(false);
    }
  }

  async function handleReplaceFile(file: File | undefined) {
    if (!file || !note || !user) return;

    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setFileError("Only PDF, DOCX, PNG, or JPG files are supported.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError("File must be under 20MB.");
      return;
    }

    setFileError(null);
    setReplacingFile(true);

    try {
      const ext = file.name.split(".").pop() ?? "";
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("notes").upload(path, file);
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("notes").getPublicUrl(path);

      const moderationRes = await fetch("/api/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: publicUrl,
          fileType: ext,
          title: title.trim(),
          description: description.trim(),
        }),
      });
      const moderation = await moderationRes.json();
      if (moderation.flagged) {
        await supabase.storage.from("notes").remove([path]);
        setFileError(
          `This file was flagged and can't be used${
            moderation.reason ? `: ${moderation.reason}` : "."
          }`
        );
        setReplacingFile(false);
        return;
      }

      const contentText =
        typeof moderation.extractedText === "string" && moderation.extractedText.trim()
          ? moderation.extractedText.slice(0, 6000)
          : null;

      await replaceNoteFile(supabase, note.id, user.id, {
        file_url: publicUrl,
        file_type: ext,
        content_text: contentText,
      });

      const oldPath = storagePathFromPublicUrl(note.file_url, "notes");
      if (oldPath) {
        await supabase.storage.from("notes").remove([oldPath]);
      }

      setNote((prev) => (prev ? { ...prev, file_url: publicUrl, file_type: ext } : prev));
      setToast("File replaced!");
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Failed to replace the file.");
    } finally {
      setReplacingFile(false);
    }
  }

  if (!authLoading && !loading && (!note || note.uploader_id !== user?.id)) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <Card className="p-10">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Can&apos;t edit this note
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            You can only edit notes you&apos;ve uploaded yourself.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-amber-500/25"
          >
            Back to dashboard
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        Edit note
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Fix a typo, tweak the description, or update tags.
      </p>

      {loading ? (
        <div className="mt-8">
          <CardSkeleton />
        </div>
      ) : (
        <Card className="mt-8 p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="flex flex-col gap-6"
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/40 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-white/40 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Tags
              </label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <AnimatePresence>
                  {selectedTags.map((tag) => (
                    <motion.span
                      key={tag.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-300"
                    >
                      {tag.name}
                      <button
                        type="button"
                        onClick={() => removeTag(tag.id)}
                        className="text-slate-400 hover:text-slate-600"
                        aria-label={`Remove ${tag.name}`}
                      >
                        ×
                      </button>
                    </motion.span>
                  ))}
                </AnimatePresence>
              </div>
              <div className="relative mt-2">
                <input
                  type="text"
                  value={tagQuery}
                  onChange={(e) => setTagQuery(e.target.value)}
                  placeholder="Search tags…"
                  className="w-full rounded-lg border border-white/40 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                />
                {tagQuery.trim() && tagSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-white/40 bg-white/90 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90">
                    {tagSuggestions.slice(0, 6).map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => addTag(tag)}
                        className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-900/5 dark:text-slate-300 dark:hover:bg-white/10"
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                File
              </label>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Current: {note?.file_type?.toUpperCase()} file
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_EXT}
                className="hidden"
                onChange={(e) => handleReplaceFile(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={replacingFile}
                className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 disabled:opacity-60 dark:border-white/20 dark:text-slate-300 dark:hover:border-white/40"
              >
                {replacingFile ? "Replacing…" : "Replace file"}
              </button>
              {fileError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fileError}</p>
              )}
            </div>

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save changes"}
              </motion.button>

              {confirmingDelete ? (
                <span className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    Delete this note?
                  </span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="font-medium text-red-600 hover:text-red-700 disabled:opacity-60 dark:text-red-400"
                  >
                    {deleting ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Delete note
                </button>
              )}
            </div>
          </form>
        </Card>
      )}

      <AnimatePresence>{toast && <Toast message={toast} />}</AnimatePresence>
    </div>
  );
}
