"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { getNoteById } from "@/lib/notes";
import FlipbookViewer from "@/components/FlipbookViewer";
import type { NoteWithMeta } from "@/lib/types";

export default function FlipbookPage() {
  const params = useParams<{ noteId: string }>();
  const supabase = useMemo(() => createClient(), []);

  const [note, setNote] = useState<NoteWithMeta | null>(null);
  const [pages, setPages] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const fetchedNote = await getNoteById(supabase, params.noteId);
      if (cancelled) return;
      setNote(fetchedNote);

      if (!fetchedNote) {
        setError("Note not found.");
        setLoading(false);
        return;
      }

      if (fetchedNote.file_type !== "pdf") {
        setError("The 3D flipbook is only available for PDF notes.");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/render-pages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileUrl: fetchedNote.file_url }),
        });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok || !data.pages?.length) {
          setError("Couldn't render this PDF for the flipbook.");
        } else {
          setPages(data.pages);
        }
      } catch {
        if (!cancelled) setError("Couldn't render this PDF for the flipbook.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [params.noteId, supabase]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-12">
      <div className="w-full">
        <Link href="/browse" className="text-sm font-medium text-amber-600 hover:text-amber-700">
          ← Back
        </Link>
        {note && (
          <h1 className="mt-2 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-2xl font-bold text-transparent">
            {note.title}
          </h1>
        )}
      </div>

      {loading && (
        <div className="flex flex-col items-center gap-3 py-24">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            className="h-10 w-10 rounded-full border-2 border-amber-400/30 border-t-amber-500"
          />
          <p className="text-sm text-slate-500">Rendering pages…</p>
        </div>
      )}

      {!loading && error && (
        <div className="rounded-[28px] border-2 border-slate-200/80 bg-white px-6 py-10 text-center shadow-xl shadow-slate-900/10">
          <p className="text-slate-600">{error}</p>
          {note && (
            <a
              href={note.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-medium text-amber-600 hover:text-amber-700"
            >
              Open the file directly →
            </a>
          )}
        </div>
      )}

      {!loading && !error && pages && <FlipbookViewer pages={pages} />}
    </div>
  );
}
