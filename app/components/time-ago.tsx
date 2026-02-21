"use client";

import { useEffect, useState } from "react";

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function TimeAgo({ date }: { date: Date | string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    const d = typeof date === "string" ? new Date(date) : date;
    setText(formatTimeAgo(d));

    const interval = setInterval(() => {
      setText(formatTimeAgo(d));
    }, 60000);

    return () => clearInterval(interval);
  }, [date]);

  return <span title={new Date(date).toLocaleString()}>{text}</span>;
}
