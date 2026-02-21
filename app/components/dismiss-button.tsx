"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DismissButton({ prId }: { prId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDismiss() {
    if (!confirm("Mark this PR as not interesting? It will stop being tracked."))
      return;

    setLoading(true);
    await fetch(`/api/prs/${prId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleDismiss}
      disabled={loading}
      className="shrink-0 inline-flex items-center gap-1.5 bg-card border border-card-border hover:border-danger hover:text-danger px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {loading ? "Dismissing..." : "Not Interesting"}
      {!loading && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
    </button>
  );
}
