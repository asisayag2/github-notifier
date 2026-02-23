"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function SortToggle({ current }: { current: "asc" | "desc" }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", current === "asc" ? "desc" : "asc");
    router.push(`/?${params.toString()}`);
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors shrink-0"
      title={current === "asc" ? "Oldest first — click to sort newest first" : "Newest first — click to sort oldest first"}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {current === "asc" ? (
          <>
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </>
        ) : (
          <>
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </>
        )}
      </svg>
      {current === "asc" ? "Oldest first" : "Newest first"}
    </button>
  );
}
