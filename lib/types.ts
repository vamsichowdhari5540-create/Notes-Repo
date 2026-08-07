export type Subject = {
  id: string;
  name: string;
  code: string;
  branch: string | null;
  semester: number | null;
};

export type Unit = {
  id: string;
  subject_id: string;
  unit_number: number;
  title: string;
};

export type Tag = {
  id: string;
  name: string;
};

export type Profile = {
  id: string;
  name: string;
  email: string;
  branch: string | null;
  year: number | null;
  avatar_url: string | null;
};

export type NoteWithMeta = {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_type: string;
  upvote_count: number;
  created_at: string;
  uploader_id: string;
  uploader_name: string;
  tags: Tag[];
  upvoted_by_me: boolean;
};

export type LeaderboardEntry = {
  userId: string;
  name: string;
  totalNotes: number;
  totalUpvotes: number;
};

export type RecentlyViewedNote = {
  noteId: string;
  viewedAt: string;
  title: string;
  unitId: string;
};
