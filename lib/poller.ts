import { prisma } from "./prisma";
import { listOpenPRs, getPRFiles, getPRDetails, getPRState } from "./github";
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
  await checkForNewPRs();
  await checkTrackedPRs();
}

async function checkForNewPRs() {
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
      data: { reviewers: JSON.stringify(current.reviewers) },
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
