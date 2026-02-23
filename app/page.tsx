import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "./components/status-badge";
import { MatchBadge } from "./components/match-badge";
import { FilterTabs } from "./components/filter-tabs";
import { TimeAgo } from "./components/time-ago";
import { DismissButton } from "./components/dismiss-button";
import { SortToggle } from "./components/sort-toggle";

interface SearchParams {
  status?: string;
  sort?: string;
}

export const dynamic = "force-dynamic";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status, sort } = await searchParams;
  const filter = status || "open";
  const sortOrder = sort === "desc" ? "desc" : "asc";

  const cutoff = new Date(Date.now() - ONE_DAY_MS);

  const where =
    filter === "all"
      ? { status: { not: "dismissed" } }
      : filter === "new"
        ? { openedAt: { gte: cutoff }, status: { not: "dismissed" } }
        : { status: filter };

  const prs = await prisma.trackedPR.findMany({
    where,
    include: {
      changes: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { openedAt: sortOrder },
  });

  const counts = await prisma.trackedPR.groupBy({
    by: ["status"],
    _count: true,
  });

  const total = counts.reduce((sum, c) => sum + c._count, 0);
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]));
  const now = Date.now();

  const newCount = await prisma.trackedPR.count({
    where: { openedAt: { gte: cutoff }, status: { not: "dismissed" } },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Tracked Pull Requests</h1>
        <p className="text-muted text-sm">
          Monitoring PRs that match your interest criteria
        </p>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Tracked" value={total} />
        <StatCard label="Open" value={countMap["open"] || 0} color="text-accent" />
        <StatCard label="Merged" value={countMap["merged"] || 0} color="text-merged" />
        <StatCard label="Closed" value={countMap["closed"] || 0} color="text-danger" />
        <StatCard label="Dismissed" value={countMap["dismissed"] || 0} color="text-muted" />
      </div>

      <div className="flex items-center justify-between mb-6">
        <FilterTabs current={filter} counts={countMap} total={total} newCount={newCount} />
        <SortToggle current={sortOrder} />
      </div>

      {prs.length === 0 ? (
        <div className="text-center py-16 text-muted">
          <svg className="mx-auto mb-4 w-12 h-12 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-lg font-medium">No tracked PRs yet</p>
          <p className="text-sm mt-1">
            Interesting PRs will appear here when they match your configured keywords or team ownership rules.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {prs.map((pr) => {
            const matchDetails = JSON.parse(pr.matchDetails || "{}");
            const lastChange = pr.changes[0];
            const openedDate = pr.openedAt ?? pr.createdAt;
            const isNew = now - new Date(openedDate).getTime() < ONE_DAY_MS;
            const reviewers: string[] = pr.reviewers ? JSON.parse(pr.reviewers) : [];

            return (
              <div
                key={pr.id}
                className={`border rounded-lg p-4 transition-colors ${
                  pr.isDraft
                    ? "bg-card/50 border-card-border/60 opacity-70 hover:opacity-90"
                    : "bg-card border-card-border hover:border-accent"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <Link href={`/pr/${pr.id}`} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-muted text-sm font-mono">
                        #{pr.prNumber}
                      </span>
                      <StatusBadge status={pr.status} />
                      {pr.isDraft && (
                        <span className="text-xs bg-muted/15 text-muted font-semibold px-2 py-0.5 rounded-full">
                          Draft
                        </span>
                      )}
                      <MatchBadge reason={pr.matchReason} />
                      {isNew && (
                        <span className="text-xs bg-accent/15 text-accent font-semibold px-2 py-0.5 rounded-full">
                          New
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold truncate">{pr.title}</h3>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted">
                      <span>by {pr.author}</span>
                      <span className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">
                        {pr.branch}
                      </span>
                      {lastChange && (
                        <span>{lastChange.diffStats}</span>
                      )}
                      <span className={reviewers.length > 0 ? "" : "text-warning"}>
                        {reviewers.length > 0
                          ? `👤 ${reviewers.join(", ")}`
                          : "No reviewer"}
                      </span>
                    </div>
                    {matchDetails.keywords?.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {matchDetails.keywords.map((kw: string) => (
                          <span
                            key={kw}
                            className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                  <div className="flex items-start gap-3 shrink-0">
                    <div className="text-right text-sm text-muted">
                      <p className="text-xs">
                        Opened <TimeAgo date={openedDate} />
                      </p>
                      <p className="text-xs mt-1">
                        Updated <TimeAgo date={pr.updatedAt} />
                      </p>
                      {pr.changes.length > 0 && (
                        <p className="text-xs mt-1">
                          {pr.changes.length} update(s)
                        </p>
                      )}
                    </div>
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted hover:text-accent transition-colors p-1"
                      title="Open on GitHub"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                    {pr.status !== "dismissed" && (
                      <DismissButton prId={pr.id} compact />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-lg p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color || ""}`}>{value}</p>
    </div>
  );
}
