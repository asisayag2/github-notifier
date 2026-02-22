"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DismissButton({
  prId,
  compact,
}: {
  prId: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDismiss(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    await fetch(`/api/prs/${prId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    });
    router.refresh();
  }

  if (compact) {
    return (
      <button
        onClick={handleDismiss}
        disabled={loading}
        title="Not Interesting"
        className="p-1.5 rounded-md text-muted hover:text-danger hover:bg-danger/10 transition-colors disabled:opacity-50"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={handleDismiss}
      disabled={loading}
      className="shrink-0 inline-flex items-center gap-1.5 bg-card border border-card-border hover:border-danger hover:text-danger px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {loading ? "Dismissing..." : "Not Interesting"}
      {!loading && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
    </button>
  );
}

export function RetrackButton({ prId }: { prId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRetrack(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    await fetch(`/api/prs/${prId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retrack" }),
    });
    router.refresh();
  }

  return (
    <button
      onClick={handleRetrack}
      disabled={loading}
      className="shrink-0 inline-flex items-center gap-1.5 bg-card border border-card-border hover:border-accent hover:text-accent px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
    >
      {loading ? "Restoring..." : "Re-track"}
      {!loading && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      )}
    </button>
  );
}
