import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LeaderboardEntry,
  NewNoteNotification,
  NoteWithMeta,
  RecentlyViewedNote,
} from "@/lib/types";

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

async function getInteractedNoteIds(
  supabase: SupabaseClient,
  table: "upvotes" | "bookmarks",
  currentUserId: string | null,
  noteIds: string[]
): Promise<Set<string>> {
  if (!currentUserId || noteIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from(table)
    .select("note_id")
    .eq("user_id", currentUserId)
    .in("note_id", noteIds);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.note_id));
}

async function getUpvotedNoteIds(
  supabase: SupabaseClient,
  currentUserId: string | null,
  noteIds: string[]
): Promise<Set<string>> {
  return getInteractedNoteIds(supabase, "upvotes", currentUserId, noteIds);
}

async function getBookmarkedNoteIds(
  supabase: SupabaseClient,
  currentUserId: string | null,
  noteIds: string[]
): Promise<Set<string>> {
  return getInteractedNoteIds(supabase, "bookmarks", currentUserId, noteIds);
}

function toNoteWithMeta(
  row: RawNoteRow,
  upvotedNoteIds: Set<string>,
  bookmarkedNoteIds: Set<string> = new Set()
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
    bookmarked_by_me: bookmarkedNoteIds.has(row.id),
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
  const noteIds = rows.map((row) => row.id);
  const [upvotedNoteIds, bookmarkedNoteIds] = await Promise.all([
    getUpvotedNoteIds(supabase, currentUserId, noteIds),
    getBookmarkedNoteIds(supabase, currentUserId, noteIds),
  ]);

  return rows.map((row) => toNoteWithMeta(row, upvotedNoteIds, bookmarkedNoteIds));
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
  const noteIds = rows.map((row) => row.id);
  const [upvotedNoteIds, bookmarkedNoteIds] = await Promise.all([
    getUpvotedNoteIds(supabase, userId, noteIds),
    getBookmarkedNoteIds(supabase, userId, noteIds),
  ]);

  return rows.map((row) => toNoteWithMeta(row, upvotedNoteIds, bookmarkedNoteIds));
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
  currentUserId: string,
  updates: { title: string; description: string | null },
  tagIds: string[]
) {
  const { error: updateError } = await supabase
    .from("notes")
    .update(updates)
    .eq("id", noteId)
    .eq("user_id", currentUserId);
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

export async function deleteNote(
  supabase: SupabaseClient,
  noteId: string,
  currentUserId: string
) {
  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", noteId)
    .eq("user_id", currentUserId);
  if (error) throw error;
}

/**
 * Swaps the underlying file on an existing note (e.g. replacing a blurry
 * scan with a clearer one) without touching its id, upvotes, or upload
 * history — only the owner can do this.
 */
export async function replaceNoteFile(
  supabase: SupabaseClient,
  noteId: string,
  currentUserId: string,
  update: { file_url: string; file_type: string; content_text: string | null }
) {
  const { error } = await supabase
    .from("notes")
    .update(update)
    .eq("id", noteId)
    .eq("user_id", currentUserId);
  if (error) throw error;
}

/**
 * Full-text search across title, description, and extracted file content
 * (title/description weighted higher than file content — see the
 * content_tsv column in 0012_note_fulltext_search.sql).
 */
export async function searchNotesByText(
  supabase: SupabaseClient,
  query: string,
  currentUserId: string | null
): Promise<NoteWithMeta[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
    .textSearch("content_tsv", trimmed, { type: "websearch", config: "english" })
    .order("upvote_count", { ascending: false })
    .limit(30);
  if (error) throw error;

  const rows = (data ?? []) as unknown as RawNoteRow[];
  const noteIds = rows.map((row) => row.id);
  const [upvotedNoteIds, bookmarkedNoteIds] = await Promise.all([
    getUpvotedNoteIds(supabase, currentUserId, noteIds),
    getBookmarkedNoteIds(supabase, currentUserId, noteIds),
  ]);

  return rows.map((row) => toNoteWithMeta(row, upvotedNoteIds, bookmarkedNoteIds));
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
  const [upvotedNoteIds, bookmarkedNoteIds] = await Promise.all([
    getUpvotedNoteIds(supabase, currentUserId, rankedNoteIds),
    getBookmarkedNoteIds(supabase, currentUserId, rankedNoteIds),
  ]);

  const rowsById = new Map(rows.map((row) => [row.id, row]));
  return rankedNoteIds
    .map((id) => rowsById.get(id))
    .filter((row): row is RawNoteRow => row !== undefined)
    .map((row) => toNoteWithMeta(row, upvotedNoteIds, bookmarkedNoteIds));
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

/**
 * New notes uploaded (by someone else) since the user's last notification
 * check, in subjects they've uploaded to, viewed, or upvoted in — see
 * get_new_notes_for_user() in 0013_note_notifications.sql for how "their
 * subjects" is inferred.
 */
export async function getNewNotes(
  supabase: SupabaseClient,
  userId: string,
  since: string,
  limit = 20
): Promise<NewNoteNotification[]> {
  const { data, error } = await supabase.rpc("get_new_notes_for_user", {
    p_user_id: userId,
    p_since: since,
    p_limit: limit,
  });
  if (error) throw error;

  return (
    (data ?? []) as {
      note_id: string;
      title: string;
      unit_id: string;
      subject_id: string;
      subject_name: string;
      created_at: string;
    }[]
  ).map((row) => ({
    noteId: row.note_id,
    title: row.title,
    unitId: row.unit_id,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    createdAt: row.created_at,
  }));
}

export async function markNotificationsSeen(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase
    .from("users")
    .update({ notifications_last_seen_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function getBookmarkedNotes(
  supabase: SupabaseClient,
  userId: string
): Promise<NoteWithMeta[]> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select(`created_at, notes ( ${NOTE_SELECT} )`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = ((data ?? []) as unknown as { notes: RawNoteRow | null }[])
    .map((row) => row.notes)
    .filter((row): row is RawNoteRow => row !== null);

  const upvotedNoteIds = await getUpvotedNoteIds(
    supabase,
    userId,
    rows.map((row) => row.id)
  );
  const bookmarkedNoteIds = new Set(rows.map((row) => row.id));

  return rows.map((row) => toNoteWithMeta(row, upvotedNoteIds, bookmarkedNoteIds));
}

export async function toggleBookmark(
  supabase: SupabaseClient,
  noteId: string,
  userId: string,
  currentlyBookmarked: boolean
) {
  const { error } = currentlyBookmarked
    ? await supabase.from("bookmarks").delete().eq("note_id", noteId).eq("user_id", userId)
    : await supabase.from("bookmarks").insert({ note_id: noteId, user_id: userId });
  if (error) throw error;
}
