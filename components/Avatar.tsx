function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const SIZE_CLASS = {
  sm: "h-8 w-8 text-xs",
  md: "h-20 w-20 text-2xl",
} as const;

type AvatarProps = {
  src?: string | null;
  name: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
};

export default function Avatar({ src, name, size = "md", className = "" }: AvatarProps) {
  const base = `flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white shadow-lg shadow-amber-500/25 ${SIZE_CLASS[size]} ${className}`;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className={`${base} object-cover`} />
    );
  }

  return (
    <div className={`bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 ${base}`}>
      {initialsOf(name) || "?"}
    </div>
  );
}
