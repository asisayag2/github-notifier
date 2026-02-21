const reasonStyles: Record<string, string> = {
  keyword: "bg-warning/10 text-warning",
  ownership: "bg-success/10 text-success",
  both: "bg-merged/10 text-merged",
};

const reasonLabels: Record<string, string> = {
  keyword: "Keyword",
  ownership: "Ownership",
  both: "Keyword + Ownership",
};

export function MatchBadge({ reason }: { reason: string }) {
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${reasonStyles[reason] || "bg-muted/10 text-muted"}`}
    >
      {reasonLabels[reason] || reason}
    </span>
  );
}
