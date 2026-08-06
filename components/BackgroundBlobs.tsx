export default function BackgroundBlobs() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="blob absolute -left-32 -top-32 h-96 w-96 rounded-full bg-teal-300/40 blur-3xl dark:bg-teal-500/20" />
      <div className="blob-delayed absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full bg-indigo-300/40 blur-3xl dark:bg-indigo-500/20" />
      <div className="blob-slow absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-violet-300/40 blur-3xl dark:bg-violet-500/15" />
    </div>
  );
}
