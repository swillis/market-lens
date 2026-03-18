"use client";

import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't process your request. Please try again.",
  retryable = true,
}: {
  title?: string;
  message?: string;
  retryable?: boolean;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="mb-4 h-12 w-12 text-red-300" />
      <h2 className="text-xl font-semibold text-zinc-900">{title}</h2>
      <p className="mt-2 max-w-md text-zinc-500">{message}</p>
      <div className="mt-6 flex gap-3">
        {retryable && (
          <button
            onClick={() => router.refresh()}
            className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-200"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        )}
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Try another ticker
        </Link>
      </div>
    </div>
  );
}
