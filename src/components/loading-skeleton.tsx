export function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Price card skeleton */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex justify-between">
          <div>
            <div className="h-7 w-24 rounded bg-zinc-800" />
            <div className="mt-2 h-5 w-48 rounded bg-zinc-800" />
          </div>
          <div className="text-right">
            <div className="h-8 w-28 rounded bg-zinc-800" />
            <div className="mt-2 h-5 w-32 rounded bg-zinc-800" />
          </div>
        </div>
      </div>

      {/* Explanation skeleton */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-zinc-800" />
          <div className="h-5 w-24 rounded bg-zinc-800" />
        </div>
        <div className="h-4 w-full rounded bg-zinc-800" />
        <div className="mt-2 h-4 w-3/4 rounded bg-zinc-800" />
      </div>

      {/* Drivers skeleton */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-zinc-800" />
          <div className="h-5 w-28 rounded bg-zinc-800" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-3 rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
            <div className="flex gap-3">
              <div className="h-6 w-6 rounded-full bg-zinc-700" />
              <div className="flex-1">
                <div className="h-4 w-48 rounded bg-zinc-800" />
                <div className="mt-2 h-3 w-full rounded bg-zinc-800" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* News skeleton */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-zinc-800" />
          <div className="h-5 w-36 rounded bg-zinc-800" />
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="mb-3 rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
            <div className="h-4 w-3/4 rounded bg-zinc-800" />
            <div className="mt-2 h-3 w-full rounded bg-zinc-800" />
            <div className="mt-2 h-3 w-24 rounded bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
