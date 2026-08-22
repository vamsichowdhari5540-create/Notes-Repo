"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import Toast from "@/components/Toast";
import Card from "@/components/Card";
import {
  ACCEPTED_FILE_EXT,
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE,
  formatFileSize,
} from "@/lib/upload-constraints";
import { findSimilarTitle } from "@/lib/similar-title";
import type { Subject, Tag, Unit } from "@/lib/types";

const REJECTION_INFO: Record<string, { emoji: string; title: string }> = {
  content: { emoji: "🚫", title: "Content policy violation" },
  relevance: { emoji: "📚", title: "Doesn't look like academic content" },
  quality: { emoji: "🔍", title: "Image quality issue" },
};
const DEFAULT_REJECTION = { emoji: "⚠️", title: "Upload rejected" };

export default function UploadPage() {
  return (
    <Suspense fallback={null}>
      <UploadForm />
    </Suspense>
  );
}

function UploadForm() {
  const supabase = useMemo(() => createClient(), []);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [unitNotes, setUnitNotes] = useState<{ id: string; title: string }[]>([]);

  const [subjectId, setSubjectId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [rejection, setRejection] = useState<{ category: string | null; reason: string } | null>(
    null
  );

  useEffect(() => {
    supabase
      .from("subjects")
      .select("id, name, code, branch, semester, year")
      .order("name")
      .then(({ data }) => {
        setSubjects(data ?? []);
        setSubjectsLoading(false);
      });
    supabase
      .from("tags")
      .select("id, name")
      .order("name")
      .then(({ data }) => setAllTags(data ?? []));
  }, [supabase]);

  useEffect(() => {
    if (!subjectId) {
      setUnits([]);
      return;
    }
    supabase
      .from("units")
      .select("id, subject_id, unit_number, title")
      .eq("subject_id", subjectId)
      .order("unit_number")
      .then(({ data }) => setUnits(data ?? []));
  }, [subjectId, supabase]);

  useEffect(() => {
    if (!unitId) {
      setUnitNotes([]);
      return;
    }
    supabase
      .from("notes")
      .select("id, title")
      .eq("unit_id", unitId)
      .then(({ data }) => setUnitNotes(data ?? []));
  }, [unitId, supabase]);

  // Pre-select subject/unit when arriving from a unit's "upload the first note" link.
  useEffect(() => {
    const presetUnitId = searchParams.get("unit");
    if (!presetUnitId) return;
    supabase
      .from("units")
      .select("id, subject_id, unit_number, title")
      .eq("id", presetUnitId)
      .single()
      .then(({ data }) => {
        if (data) {
          setSubjectId(data.subject_id);
          setUnitId(data.id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tagSuggestions = allTags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(tagQuery.trim().toLowerCase()) &&
      !selectedTags.some((t) => t.id === tag.id)
  );
  const exactMatch = allTags.some(
    (tag) => tag.name.toLowerCase() === tagQuery.trim().toLowerCase()
  );

  const similarNote = findSimilarTitle(title, unitNotes);

  function addTag(tag: Tag) {
    setSelectedTags((prev) => [...prev, tag]);
    setTagQuery("");
  }

  async function addNewTag() {
    const name = tagQuery.trim().toLowerCase();
    if (!name) return;
    const { data, error } = await supabase
      .from("tags")
      .insert({ name })
      .select("id, name")
      .single();
    if (!error && data) {
      setAllTags((prev) => [...prev, data]);
      addTag(data);
    }
  }

  function removeTag(tagId: string) {
    setSelectedTags((prev) => prev.filter((t) => t.id !== tagId));
  }

  // Matches AI-suggested tag names against existing tags (case-insensitive),
  // creating any that don't exist yet — same "authenticated users can add
  // tags" path the manual tag input already uses.
  async function resolveOrCreateTags(names: string[]): Promise<Tag[]> {
    const resolved: Tag[] = [];
    for (const rawName of names) {
      const name = rawName.trim().toLowerCase();
      if (!name) continue;
      const existing = allTags.find((t) => t.name.toLowerCase() === name);
      if (existing) {
        resolved.push(existing);
        continue;
      }
      const { data, error } = await supabase
        .from("tags")
        .insert({ name })
        .select("id, name")
        .single();
      if (!error && data) {
        setAllTags((prev) => [...prev, data]);
        resolved.push(data);
      }
    }
    return resolved;
  }

  function pickFile(candidate: File | undefined) {
    if (!candidate) return;
    if (!ACCEPTED_FILE_TYPES.includes(candidate.type)) {
      setErrors((prev) => ({
        ...prev,
        file: "Only PDF, DOCX, PNG, or JPG files are supported.",
      }));
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({
        ...prev,
        file: "File must be under 20MB.",
      }));
      return;
    }
    setErrors((prev) => ({ ...prev, file: "" }));
    setFile(candidate);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    pickFile(event.dataTransfer.files?.[0]);
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!subjectId) next.subject = "Choose a subject.";
    if (!unitId) next.unit = "Choose a unit.";
    if (!title.trim()) next.title = "Title is required.";
    if (!file) next.file = "Attach a file to upload.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate() || !file || !user) return;
    setSubmitting(true);
    setRejection(null);

    try {
      const ext = file.name.split(".").pop() ?? "";
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("notes")
        .upload(path, file);
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
        setRejection({
          category: typeof moderation.category === "string" ? moderation.category : null,
          reason: typeof moderation.reason === "string" && moderation.reason ? moderation.reason : "This upload doesn't meet our content guidelines.",
        });
        setSubmitting(false);
        return;
      }

      // AI-suggested tags merge with whatever the uploader already picked —
      // existing selections win on name collisions, nothing is duplicated.
      const suggestedTags: string[] = Array.isArray(moderation.tags) ? moderation.tags : [];
      const resolvedSuggested = await resolveOrCreateTags(suggestedTags);
      const mergedTags = [
        ...selectedTags,
        ...resolvedSuggested.filter(
          (t) => !selectedTags.some((s) => s.id === t.id)
        ),
      ];

      const summary =
        typeof moderation.summary === "string" && moderation.summary.trim()
          ? moderation.summary.trim()
          : null;
      const aiVerified = Boolean(moderation.aiVerified);

      const { data: note, error: insertError } = await supabase
        .from("notes")
        .insert({
          user_id: user.id,
          unit_id: unitId,
          title: title.trim(),
          description: description.trim() || null,
          file_url: publicUrl,
          file_type: ext,
          summary,
          ai_verified: aiVerified,
          content_text:
            typeof moderation.extractedText === "string" && moderation.extractedText.trim()
              ? moderation.extractedText.slice(0, 6000)
              : null,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      if (mergedTags.length > 0) {
        const { error: tagError } = await supabase.from("note_tags").insert(
          mergedTags.map((tag) => ({ note_id: note.id, tag_id: tag.id }))
        );
        if (tagError) throw tagError;
      }

      // Non-blocking sanity check: does the AI's detected unit match what
      // was actually selected? Informational only — the note is already
      // saved either way.
      const detectedUnit = Number.isInteger(moderation.unit) ? moderation.unit : null;
      const selectedUnitNumber = units.find((u) => u.id === unitId)?.unit_number ?? null;
      const unitMismatch =
        detectedUnit !== null && selectedUnitNumber !== null && detectedUnit !== selectedUnitNumber;

      const tagNote = resolvedSuggested.length > 0 ? ` ${resolvedSuggested.length} tag${resolvedSuggested.length === 1 ? "" : "s"} auto-added.` : "";
      const unitNote = unitMismatch
        ? ` Heads up: this looks like Unit ${detectedUnit} content, but you filed it under Unit ${selectedUnitNumber}.`
        : "";
      setToast(`Note uploaded!${tagNote}${unitNote}`);
      setTimeout(() => router.push(`/units/${unitId}`), unitMismatch ? 2200 : 800);
    } catch (err) {
      console.error("Upload failed:", err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Something went wrong. Try again.";
      setErrors((prev) => ({ ...prev, submit: message }));
      setSubmitting(false);
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <Card className="p-10">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Log in to upload notes
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            You need an account to share notes with your class.
          </p>
          <motion.div
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="mt-6 inline-block"
          >
            <Link
              href="/login"
              className="inline-block rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-amber-500/25"
            >
              Log in
            </Link>
          </motion.div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
        Upload a note
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Share your notes so your classmates can find them by subject and tag.
      </p>

      <Card className="mt-8 p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="flex flex-col gap-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Subject
              </label>
              <select
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setUnitId("");
                }}
                disabled={subjectsLoading}
                className="mt-1 w-full rounded-lg border border-white/40 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:bg-slate-900/5 disabled:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              >
                <option value="">
                  {subjectsLoading ? "Loading subjects…" : "Select a subject"}
                </option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {errors.subject && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.subject}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Unit
              </label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                disabled={!subjectId}
                className="mt-1 w-full rounded-lg border border-white/40 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:bg-slate-900/5 disabled:text-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              >
                <option value="">Select a unit</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {subjects.find((s) => s.id === subjectId)?.name} :: Unit {u.unit_number}
                  </option>
                ))}
              </select>
              {errors.unit && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.unit}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/40 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              placeholder="e.g. Unit 3 exam revision notes"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.title}</p>
            )}
            {!errors.title && similarNote && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                A note titled &ldquo;{similarNote.title}&rdquo; already exists in this unit —
                you can still upload if this one&apos;s different.
              </p>
            )}
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
              placeholder="What's covered in these notes?"
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
                placeholder="Search or add a tag…"
                className="w-full rounded-lg border border-white/40 bg-white/70 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              />
              {tagQuery.trim() && (
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
                  {!exactMatch && (
                    <button
                      type="button"
                      onClick={addNewTag}
                      className="block w-full border-t border-slate-900/10 px-3 py-2 text-left text-sm font-medium text-amber-600 hover:bg-slate-50 dark:border-white/10 dark:text-amber-400 dark:hover:bg-white/10"
                    >
                      Add “{tagQuery.trim()}”
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              File
            </label>
            <motion.div
              animate={{ scale: dragging ? 1.02 : 1 }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-1 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
                dragging
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-slate-300 hover:border-slate-400 dark:border-white/20 dark:hover:border-white/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_EXT}
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              {file ? (
                <>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatFileSize(file.size)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Drag and drop a file, or click to browse
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    PDF, DOCX, PNG, or JPG
                  </p>
                </>
              )}
            </motion.div>
            {errors.file && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.file}</p>
            )}
          </div>

          {rejection && (
            <div className="rounded-lg border border-red-200 bg-red-500/10 px-4 py-3 dark:border-red-500/30">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                {(rejection.category && REJECTION_INFO[rejection.category]?.emoji) ??
                  DEFAULT_REJECTION.emoji}{" "}
                {(rejection.category && REJECTION_INFO[rejection.category]?.title) ??
                  DEFAULT_REJECTION.title}
              </p>
              <p className="mt-1 text-sm text-red-600 dark:text-red-300">{rejection.reason}</p>
            </div>
          )}

          {errors.submit && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
              {errors.submit}
            </p>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={submitting}
            className="rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-amber-500/25 disabled:opacity-60"
          >
            {submitting ? "Uploading…" : "Upload note"}
          </motion.button>
        </form>
      </Card>

      <AnimatePresence>{toast && <Toast message={toast} />}</AnimatePresence>
    </div>
  );
}
