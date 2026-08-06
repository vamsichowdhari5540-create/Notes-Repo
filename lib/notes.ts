import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeaderboardEntry, NoteWithMeta, RecentlyViewedNote } from "@/lib/types";

type RawNoteRow = {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  upvote_count: number;
  created_at: string;
  user_id: string;
  users: { name: string } | null;
  note_tags: { tags: { id: string; name: string } | null }[];
};

const NOTE_SELECT = `id, title, description, file_url, file_type, upvote_count, created_at, user_id,
       users ( name ),
       note_tags ( tags ( id, name ) )`;

async function getUpvotedNoteIds(
  supabase: SupabaseClient,
  currentUserId: string | null,
  noteIds: string[]
): Promise<Set<string>> {
  if (!currentUserId || noteIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("upvotes")
    .select("note_id")
    .eq("user_id", currentUserId)
    .in("note_id", noteIds);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.note_id));
}

function toNoteWithMeta(
  row: RawNoteRow,
  upvotedNoteIds: Set<string>
): NoteWithMeta {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    file_url: row.file_url,
    file_type: row.file_type,
    upvote_count: row.upvote_count,
    created_at: row.created_at,
    uploader_id: row.user_id,
    uploader_name: row.users?.name ?? "Unknown",
    tags: row.note_tags
      .map((nt) => nt.tags)
      .filter((tag): tag is { id: string; name: string } => tag !== null),
    upvoted_by_me: upvotedNoteIds.has(row.id),
  };
}

export async function getNotesForUnit(
  supabase: SupabaseClient,
  unitId: string,
  currentUserId: string | null,
  sortBy: "upvotes" | "recent" = "upvotes"
): Promise<NoteWithMeta[]> {
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
    .eq("unit_id", unitId)
    .order(sortBy === "upvotes" ? "upvote_count" : "created_at", {
      ascending: false,
    });

  if (error) throw error;

  const rows = (data ?? []) as unknown as RawNoteRow[];
  const upvotedNoteIds = await getUpvotedNoteIds(
    supabase,
    currentUserId,
    rows.map((row) => row.id)
  );

  return rows.map((row) => toNoteWithMeta(row, upvotedNoteIds));
}

export async function getNotesForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<NoteWithMeta[]> {
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as unknown as RawNoteRow[];
  const upvotedNoteIds = await getUpvotedNoteIds(
    supabase,
    userId,
    rows.map((row) => row.id)
  );

  return rows.map((row) => toNoteWithMeta(row, upvotedNoteIds));
}

export async function getNoteById(
  supabase: SupabaseClient,
  noteId: string
): Promise<NoteWithMeta | null> {
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
    .eq("id", noteId)
    .single();

  if (error) return null;
  const row = data as unknown as RawNoteRow;
  return toNoteWithMeta(row, new Set());
}

export async function updateNote(
  supabase: SupabaseClient,
  noteId: string,
  updates: { title: string; description: string | null },
  tagIds: string[]
) {
  const { error: updateError } = await supabase
    .from("notes")
    .update(updates)
    .eq("id", noteId);
  if (updateError) throw updateError;

  const { error: deleteTagsError } = await supabase
    .from("note_tags")
    .delete()
    .eq("note_id", noteId);
  if (deleteTagsError) throw deleteTagsError;

  if (tagIds.length > 0) {
    const { error: insertTagsError } = await supabase
      .from("note_tags")
      .insert(tagIds.map((tagId) => ({ note_id: noteId, tag_id: tagId })));
    if (insertTagsError) throw insertTagsError;
  }
}

export async function deleteNote(supabase: SupabaseClient, noteId: string) {
  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  if (error) throw error;
}

/**
 * Ranks notes by how many of the given tags they match (most overlap
 * first), so this is the one place that implements the "which tags did
 * this note match" ranking — reuse it rather than re-deriving the count.
 */
export async function searchNotesByTags(
  supabase: SupabaseClient,
  tagIds: string[],
  currentUserId: string | null
): Promise<NoteWithMeta[]> {
  if (tagIds.length === 0) return [];

  const { data: matches, error: matchError } = await supabase
    .from("note_tags")
    .select("note_id, tag_id")
    .in("tag_id", tagIds);
  if (matchError) throw matchError;

  const matchCountByNoteId = new Map<string, number>();
  for (const row of matches ?? []) {
    matchCountByNoteId.set(
      row.note_id,
      (matchCountByNoteId.get(row.note_id) ?? 0) + 1
    );
  }

  const rankedNoteIds = [...matchCountByNoteId.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([noteId]) => noteId);
  if (rankedNoteIds.length === 0) return [];

  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
    .in("id", rankedNoteIds);
  if (error) throw error;

  const rows = (data ?? []) as unknown as RawNoteRow[];
  const upvotedNoteIds = await getUpvotedNoteIds(
    supabase,
    currentUserId,
    rankedNoteIds
  );

  const rowsById = new Map(rows.map((row) => [row.id, row]));
  return rankedNoteIds
    .map((id) => rowsById.get(id))
    .filter((row): row is RawNoteRow => row !== undefined)
    .map((row) => toNoteWithMeta(row, upvotedNoteIds));
}

/**
 * Ranks students by upvotes received across all their uploads (ties broken
 * by note count) — the one place that implements "who's contributing the
 * most/best notes" so the dashboard and any future leaderboard-like view
 * stay consistent.
 */
export async function getLeaderboard(
  supabase: SupabaseClient,
  limit = 10
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("user_id, upvote_count, users ( name )");
  if (error) throw error;

  const byUser = new Map<string, LeaderboardEntry>();
  for (const row of (data ?? []) as unknown as {
    user_id: string;
    upvote_count: number;
    users: { name: string } | null;
  }[]) {
    const existing = byUser.get(row.user_id);
    if (existing) {
      existing.totalNotes += 1;
      existing.totalUpvotes += row.upvote_count;
    } else {
      byUser.set(row.user_id, {
        userId: row.user_id,
        name: row.users?.name ?? "Unknown",
        totalNotes: 1,
        totalUpvotes: row.upvote_count,
      });
    }
  }

  return [...byUser.values()]
    .sort((a, b) => b.totalUpvotes - a.totalUpvotes || b.totalNotes - a.totalNotes)
    .slice(0, limit);
}

export async function recordNoteView(
  supabase: SupabaseClient,
  noteId: string,
  userId: string
) {
  await supabase
    .from("note_views")
    .upsert(
      { user_id: userId, note_id: noteId, viewed_at: new Date().toISOString() },
      { onConflict: "user_id,note_id" }
    );
}

export async function getRecentlyViewed(
  supabase: SupabaseClient,
  userId: string,
  limit = 5
): Promise<RecentlyViewedNote[]> {
  const { data, error } = await supabase
    .from("note_views")
    .select("viewed_at, notes ( id, title, unit_id )")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (
    (data ?? []) as unknown as {
      viewed_at: string;
      notes: { id: string; title: string; unit_id: string } | null;
    }[]
  )
    .filter((row) => row.notes !== null)
    .map((row) => ({
      noteId: row.notes!.id,
      title: row.notes!.title,
      unitId: row.notes!.unit_id,
      viewedAt: row.viewed_at,
    }));
}
