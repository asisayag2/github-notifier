const statusStyles: Record<string, string> = {
  open: "bg-accent/10 text-accent",
  merged: "bg-merged/10 text-merged",
  closed: "bg-danger/10 text-danger",
  dismissed: "bg-muted/10 text-muted",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  merged: "Merged",
  closed: "Closed",
  dismissed: "Dismissed",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusStyles[status] || "bg-muted/10 text-muted"}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          status === "open"
            ? "bg-accent"
            : status === "merged"
              ? "bg-merged"
              : status === "dismissed"
                ? "bg-muted"
                : "bg-danger"
        }`}
      />
      {statusLabels[status] || status}
    </span>
  );
}
