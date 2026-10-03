type NatoriSkeletonProps = {
  /** Tailwind height class, e.g. "h-24". */
  heightClassName?: string;
  className?: string;
};

export function NatoriSkeleton({ heightClassName = "h-24", className = "" }: NatoriSkeletonProps) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-2xl bg-gray-100 motion-reduce:animate-none ${heightClassName} ${className}`.trim()}
    />
  );
}
