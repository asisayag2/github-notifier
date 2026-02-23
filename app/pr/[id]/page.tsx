import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/app/components/status-badge";
import { MatchBadge } from "@/app/components/match-badge";
import { TimeAgo } from "@/app/components/time-ago";
import { DismissButton, RetrackButton } from "@/app/components/dismiss-button";

export const dynamic = "force-dynamic";

export default async function PRDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const pr = await prisma.trackedPR.findUnique({
    where: { id },
    include: {
      changes: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!pr) {
    notFound();
  }

  const matchDetails = JSON.parse(pr.matchDetails || "{}");
  const reviewers: string[] = pr.reviewers ? JSON.parse(pr.reviewers) : [];

  return (
    <div>
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-6 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        Back to Dashboard
      </Link>

      <div className="bg-card border border-card-border rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-muted font-mono">#{pr.prNumber}</span>
              <StatusBadge status={pr.status} />
              {pr.isDraft && (
                <span className="text-xs bg-muted/15 text-muted font-semibold px-2 py-0.5 rounded-full">
                  Draft
                </span>
              )}
              <MatchBadge reason={pr.matchReason} />
            </div>
            <h1 className="text-xl font-bold">{pr.title}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pr.status === "dismissed" ? (
              <RetrackButton prId={pr.id} />
            ) : (
              <DismissButton prId={pr.id} />
            )}
            <a
              href={pr.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              View on GitHub
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
          <div>
            <span className="text-muted block">Author</span>
            <span className="font-medium">{pr.author}</span>
          </div>
          <div>
            <span className="text-muted block">Branch</span>
            <code className="text-xs bg-background px-1.5 py-0.5 rounded">{pr.branch}</code>
          </div>
          <div>
            <span className="text-muted block">Opened</span>
            <TimeAgo date={pr.openedAt ?? pr.createdAt} />
          </div>
          <div>
            <span className="text-muted block">Last Update</span>
            <TimeAgo date={pr.updatedAt} />
          </div>
          <div>
            <span className="text-muted block">Reviewer</span>
            {reviewers.length > 0 ? (
              <span className="font-medium">{reviewers.join(", ")}</span>
            ) : (
              <span className="text-warning">No reviewer</span>
            )}
          </div>
        </div>

        {pr.description && (
          <div className="mt-4 pt-4 border-t border-card-border">
            <h3 className="text-sm font-medium text-muted mb-2">Description</h3>
            <div className="text-sm whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
              {pr.description}
            </div>
          </div>
        )}

        {(matchDetails.keywords?.length > 0 || matchDetails.teams?.length > 0) && (
          <div className="mt-4 pt-4 border-t border-card-border">
            <h3 className="text-sm font-medium text-muted mb-2">Match Details</h3>
            {matchDetails.keywords?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="text-xs text-muted">Keywords:</span>
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
            {matchDetails.teams?.length > 0 &&
              matchDetails.teams.map(
                (tm: { team: string; files: string[] }) => (
                  <div key={tm.team} className="mt-2">
                    <span className="text-xs text-muted">
                      Team &quot;{tm.team}&quot; owned files:
                    </span>
                    <ul className="mt-1 space-y-0.5">
                      {tm.files.map((f: string) => (
                        <li
                          key={f}
                          className="text-xs font-mono text-success pl-3"
                        >
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              )}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">
          Change Timeline
          <span className="text-sm font-normal text-muted ml-2">
            {pr.changes.length} update(s)
          </span>
        </h2>

        {pr.changes.length === 0 ? (
          <div className="text-center py-12 text-muted bg-card border border-card-border rounded-lg">
            <p>No code changes recorded yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pr.changes.map((change, index) => {
              const files: string[] = JSON.parse(change.filesChanged || "[]");

              return (
                <div
                  key={change.id}
                  className="relative bg-card border border-card-border rounded-lg p-4"
                >
                  {index < pr.changes.length - 1 && (
                    <div className="absolute left-8 top-full w-px h-4 bg-card-border" />
                  )}

                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="4" />
                          <line x1="1.05" y1="12" x2="7" y2="12" />
                          <line x1="17.01" y1="12" x2="22.96" y2="12" />
                        </svg>
                      </div>
                      <div>
                        <code className="text-xs bg-background px-1.5 py-0.5 rounded">
                          {change.commitSha.substring(0, 7)}
                        </code>
                        <span className="text-xs text-muted ml-2">
                          {change.diffStats}
                        </span>
                      </div>
                    </div>
                    <TimeAgo date={change.createdAt} />
                  </div>

                  <p className="text-sm mb-3">{change.summary}</p>

                  {files.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted hover:text-foreground transition-colors">
                        {files.length} file(s) changed
                      </summary>
                      <ul className="mt-2 space-y-0.5 pl-4 font-mono text-muted">
                        {files.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
