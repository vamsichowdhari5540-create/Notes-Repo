// Restricts server-side fetches to URLs that point at our own Supabase
// storage buckets, so API routes that fetch a "fileUrl" from the request
// body can't be used as an open SSRF proxy against arbitrary hosts.
export function isAllowedStorageUrl(url: string): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return false;

  try {
    const parsed = new URL(url);
    const base = new URL(supabaseUrl);
    return (
      parsed.protocol === "https:" &&
      parsed.host === base.host &&
      parsed.pathname.startsWith("/storage/v1/object/public/")
    );
  } catch {
    return false;
  }
}

// Extracts the storage object path (e.g. "userId/123-abc.pdf") from a
// public URL for the given bucket, so a replaced file's old object can be
// removed instead of accumulating orphaned files in storage.
export function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}
