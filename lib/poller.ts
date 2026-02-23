import { prisma } from "./prisma";
import { listOpenPRs, getPRFiles, getPRDetails, getPRState, type PRSummary } from "./github";
import { checkInterest } from "./interest-matcher";
import {
  sendNewPREmail,
  sendCodeChangeEmail,
  sendMergeEmail,
} from "./email";

const DEFAULT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const MAX_NEW_PRS_PER_CYCLE = 5;
const MAX_TRACKED_CHECKS_PER_CYCLE = 10;

let pollingTimer: ReturnType<typeof setInterval> | null = null;

export function startPolling() {
  const intervalMs = parseInt(
    process.env.POLL_INTERVAL_MS || String(DEFAULT_INTERVAL_MS),
    10
  );

  console.log(
    `[Poller] Starting with ${intervalMs / 1000}s interval`
  );

  poll().catch((err) => console.error("[Poller] Initial poll failed:", err));

  pollingTimer = setInterval(() => {
    poll().catch((err) => console.error("[Poller] Poll cycle failed:", err));
  }, intervalMs);
}

export function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
    console.log("[Poller] Stopped");
  }
}

async function poll() {
  console.log(`[Poller] Polling at ${new Date().toISOString()}`);
  const openPRs = await checkForNewPRs();
  const openPRNumbers = new Set(openPRs.map((pr) => pr.number));
  await bulkUpdateFromListData(openPRs);
  await syncStatuses(openPRNumbers);
  await checkTrackedPRs();
}

async function checkForNewPRs(): Promise<PRSummary[]> {
  const openPRs = await listOpenPRs();

  const trackedNumbers = new Set(
    (await prisma.trackedPR.findMany({ select: { prNumber: true } })).map(
      (p) => p.prNumber
    )
  );

  let processed = 0;
  for (const pr of openPRs) {
    if (processed >= MAX_NEW_PRS_PER_CYCLE) {
      console.log(`[Poller] Reached ${MAX_NEW_PRS_PER_CYCLE} new PRs limit, deferring rest to next cycle`);
      break;
    }

    if (trackedNumbers.has(pr.number)) continue;

    const files = await getPRFiles(pr.number);
    const matchResult = await checkInterest(
      pr.title,
      pr.body,
      pr.branch,
      files
    );

    if (!matchResult.isInteresting) {
      processed++;
      continue;
    }

    const details = await getPRDetails(pr.number);

    console.log(
      `[Poller] New interesting PR #${pr.number}: ${pr.title}`
    );

    await prisma.trackedPR.create({
      data: {
        prNumber: pr.number,
        title: pr.title,
        description: pr.body || "",
        reviewers: JSON.stringify(pr.requestedReviewers),
        author: pr.author,
        url: pr.url,
        branch: pr.branch,
        matchReason: matchResult.reason,
        matchDetails: JSON.stringify({
          keywords: matchResult.matchedKeywords,
          teams: matchResult.matchedTeams,
        }),
        status: "open",
        isDraft: pr.draft,
        openedAt: new Date(pr.createdAt),
      },
    });

    try {
      await sendNewPREmail({
        prNumber: pr.number,
        title: pr.title,
        author: pr.author,
        url: pr.url,
        branch: pr.branch,
        matchResult,
        filesChanged: details.changedFiles,
        additions: details.additions,
        deletions: details.deletions,
      });
      console.log(`[Poller] Email sent for new PR #${pr.number}`);
    } catch (emailErr) {
      console.error(`[Poller] Failed to send email for PR #${pr.number}:`, emailErr);
    }

    processed++;
  }

  return openPRs;
}

async function bulkUpdateFromListData(openPRs: PRSummary[]) {
  const prMap = new Map(openPRs.map((pr) => [pr.number, pr]));

  const trackedOpen = await prisma.trackedPR.findMany({
    where: { status: "open" },
    select: { id: true, prNumber: true, reviewers: true, isDraft: true },
  });

  let updated = 0;
  for (const tracked of trackedOpen) {
    const ghPR = prMap.get(tracked.prNumber);
    if (!ghPR) continue;

    const currentReviewers = tracked.reviewers || "[]";
    const existingReviewers: string[] = currentReviewers ? JSON.parse(currentReviewers) : [];
    const freshReviewers = [...new Set([...existingReviewers, ...ghPR.requestedReviewers])];
    const needsUpdate =
      tracked.isDraft !== ghPR.draft ||
      JSON.stringify(freshReviewers.sort()) !== JSON.stringify(existingReviewers.sort());

    if (needsUpdate) {
      await prisma.trackedPR.update({
        where: { id: tracked.id },
        data: {
          isDraft: ghPR.draft,
          reviewers: JSON.stringify(freshReviewers),
        },
      });
      updated++;
    }
  }

  if (updated > 0) {
    console.log(`[Poller] Bulk-updated draft/reviewers for ${updated} tracked PRs`);
  }
}

async function syncStatuses(openPRNumbers: Set<number>) {
  const trackedOpen = await prisma.trackedPR.findMany({
    where: { status: "open" },
    select: { id: true, prNumber: true, title: true, author: true, url: true },
  });

  const stale = trackedOpen.filter((pr) => !openPRNumbers.has(pr.prNumber));
  if (stale.length === 0) return;

  console.log(`[Poller] Found ${stale.length} tracked PRs no longer open on GitHub, syncing statuses`);

  for (const pr of stale) {
    try {
      const current = await getPRState(pr.prNumber);
      if (current.state === "closed") {
        const newStatus = current.merged ? "merged" : "closed";
        console.log(`[Poller] PR #${pr.prNumber} status synced to ${newStatus}`);
        await prisma.trackedPR.update({
          where: { id: pr.id },
          data: {
            status: newStatus,
            mergedAt: current.merged ? new Date() : null,
            reviewers: JSON.stringify(current.reviewers),
          },
        });
        if (current.merged) {
          try {
            await sendMergeEmail({
              prNumber: pr.prNumber,
              title: pr.title,
              author: pr.author,
              url: pr.url,
            });
          } catch (emailErr) {
            console.error(`[Poller] Failed to send merge email for PR #${pr.prNumber}:`, emailErr);
          }
        }
      }
    } catch (err) {
      console.error(`[Poller] Failed to sync status for PR #${pr.prNumber}:`, err);
    }
  }
}

async function checkTrackedPRs() {
  const trackedPRs = await prisma.trackedPR.findMany({
    where: { status: "open" },
    include: {
      changes: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  let checked = 0;
  for (const tracked of trackedPRs) {
    if (checked >= MAX_TRACKED_CHECKS_PER_CYCLE) {
      console.log(`[Poller] Reached ${MAX_TRACKED_CHECKS_PER_CYCLE} tracked PR checks limit, deferring rest`);
      break;
    }
    checked++;
    const current = await getPRState(tracked.prNumber);

    if (current.state === "closed") {
      const newStatus = current.merged ? "merged" : "closed";
      console.log(
        `[Poller] PR #${tracked.prNumber} is now ${newStatus}`
      );

      await prisma.trackedPR.update({
        where: { prNumber: tracked.prNumber },
        data: {
          status: newStatus,
          mergedAt: current.merged ? new Date() : null,
        },
      });

      if (current.merged) {
        try {
          await sendMergeEmail({
            prNumber: tracked.prNumber,
            title: tracked.title,
            author: tracked.author,
            url: tracked.url,
          });
          console.log(`[Poller] Merge email sent for PR #${tracked.prNumber}`);
        } catch (emailErr) {
          console.error(`[Poller] Failed to send merge email for PR #${tracked.prNumber}:`, emailErr);
        }
      }
      continue;
    }

    await prisma.trackedPR.update({
      where: { prNumber: tracked.prNumber },
      data: {
        reviewers: JSON.stringify(current.reviewers),
        isDraft: current.draft,
      },
    });

    const lastKnownSha = tracked.changes[0]?.commitSha;
    if (lastKnownSha === current.headSha) continue;

    console.log(
      `[Poller] PR #${tracked.prNumber} has new commits (${current.headSha.substring(0, 7)})`
    );

    const files = await getPRFiles(tracked.prNumber);
    const fileNames = files.map((f) => f.filename);
    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
    const diffStats = `${files.length} files, +${totalAdditions} -${totalDeletions}`;
    const summary = buildChangeSummary(files);

    await prisma.pRChange.create({
      data: {
        trackedPRId: tracked.id,
        commitSha: current.headSha,
        summary,
        filesChanged: JSON.stringify(fileNames),
        diffStats,
        notifiedAt: new Date(),
      },
    });

    await prisma.trackedPR.update({
      where: { prNumber: tracked.prNumber },
      data: {
        title: current.title || tracked.title,
        reviewers: JSON.stringify(current.reviewers),
        updatedAt: new Date(),
      },
    });

    try {
      await sendCodeChangeEmail({
        prNumber: tracked.prNumber,
        title: tracked.title,
        url: tracked.url,
        commitSha: current.headSha,
        filesChanged: fileNames,
        diffStats,
        summary,
      });
      console.log(`[Poller] Code change email sent for PR #${tracked.prNumber}`);
    } catch (emailErr) {
      console.error(`[Poller] Failed to send code change email for PR #${tracked.prNumber}:`, emailErr);
    }
  }
}

function buildChangeSummary(
  files: {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
  }[]
): string {
  const byStatus = new Map<string, number>();
  for (const f of files) {
    byStatus.set(f.status, (byStatus.get(f.status) || 0) + 1);
  }

  const parts: string[] = [];
  for (const [status, count] of byStatus) {
    parts.push(`${count} file(s) ${status}`);
  }

  const topFiles = files
    .sort((a, b) => b.additions + b.deletions - (a.additions + a.deletions))
    .slice(0, 5)
    .map((f) => `${f.filename} (+${f.additions}/-${f.deletions})`)
    .join(", ");

  return `${parts.join(", ")}. Most changed: ${topFiles}`;
}
