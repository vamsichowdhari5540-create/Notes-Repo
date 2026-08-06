export function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/40 bg-white/60 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="h-4 w-2/3 rounded bg-slate-900/10 dark:bg-white/10" />
      <div className="mt-2 h-3 w-1/3 rounded bg-slate-900/5 dark:bg-white/5" />
      <div className="mt-4 h-3 w-full rounded bg-slate-900/5 dark:bg-white/5" />
      <div className="mt-1.5 h-3 w-5/6 rounded bg-slate-900/5 dark:bg-white/5" />
    </div>
  );
}

export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
