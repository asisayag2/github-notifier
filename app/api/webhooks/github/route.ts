import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getPRFiles, getPRDetails } from "@/lib/github";
import { checkInterest } from "@/lib/interest-matcher";
import {
  sendNewPREmail,
  sendCodeChangeEmail,
  sendMergeEmail,
} from "@/lib/email";

export async function POST(request: NextRequest) {
  const body = await request.text();

  if (!verifySignature(request, body)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  if (event !== "pull_request") {
    return NextResponse.json({ message: "Ignored event" }, { status: 200 });
  }

  const payload = JSON.parse(body);
  const action = payload.action as string;

  try {
    switch (action) {
      case "opened":
      case "reopened":
        await handlePROpened(payload);
        break;
      case "synchronize":
        await handlePRSynchronize(payload);
        break;
      case "closed":
        await handlePRClosed(payload);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(`Error handling PR event (${action}):`, error);
    return NextResponse.json(
      { error: "Internal processing error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: "OK" }, { status: 200 });
}

function verifySignature(request: NextRequest, body: string): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    console.warn("WEBHOOK_SECRET not set, skipping signature verification");
    return true;
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!signature) return false;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  const expected = `sha256=${hmac.digest("hex")}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

async function handlePROpened(payload: Record<string, unknown>) {
  const pr = payload.pull_request as Record<string, unknown>;
  const prNumber = pr.number as number;
  const title = pr.title as string;
  const body = (pr.body as string) || "";
  const author = (pr.user as Record<string, unknown>).login as string;
  const url = pr.html_url as string;
  const branch = (pr.head as Record<string, unknown>).ref as string;

  const existing = await prisma.trackedPR.findUnique({
    where: { prNumber },
  });
  if (existing) return;

  const files = await getPRFiles(prNumber);
  const matchResult = await checkInterest(title, body, branch, files);

  if (!matchResult.isInteresting) return;

  const details = await getPRDetails(prNumber);

  await prisma.trackedPR.create({
    data: {
      prNumber,
      title,
      author,
      url,
      branch,
      matchReason: matchResult.reason,
      matchDetails: JSON.stringify({
        keywords: matchResult.matchedKeywords,
        teams: matchResult.matchedTeams,
      }),
      status: "open",
    },
  });

  await sendNewPREmail({
    prNumber,
    title,
    body,
    author,
    url,
    branch,
    matchResult,
    filesChanged: details.changedFiles,
    additions: details.additions,
    deletions: details.deletions,
  });
}

async function handlePRSynchronize(payload: Record<string, unknown>) {
  const pr = payload.pull_request as Record<string, unknown>;
  const prNumber = pr.number as number;

  const tracked = await prisma.trackedPR.findUnique({
    where: { prNumber },
  });
  if (!tracked || tracked.status !== "open") return;

  const beforeSha = (payload.before as string) || "";
  const afterSha = (payload.after as string) || "";

  const files = await getPRFiles(prNumber);
  const fileNames = files.map((f) => f.filename);

  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);
  const diffStats = `${files.length} files, +${totalAdditions} -${totalDeletions}`;

  const summary = buildChangeSummary(files);

  await prisma.pRChange.create({
    data: {
      trackedPRId: tracked.id,
      commitSha: afterSha,
      summary,
      filesChanged: JSON.stringify(fileNames),
      diffStats,
      notifiedAt: new Date(),
    },
  });

  await prisma.trackedPR.update({
    where: { prNumber },
    data: {
      title: (pr.title as string) || tracked.title,
      updatedAt: new Date(),
    },
  });

  await sendCodeChangeEmail({
    prNumber,
    title: tracked.title,
    url: tracked.url,
    commitSha: afterSha || beforeSha,
    filesChanged: fileNames,
    diffStats,
    summary,
  });
}

async function handlePRClosed(payload: Record<string, unknown>) {
  const pr = payload.pull_request as Record<string, unknown>;
  const prNumber = pr.number as number;
  const merged = pr.merged as boolean;

  const tracked = await prisma.trackedPR.findUnique({
    where: { prNumber },
  });
  if (!tracked) return;

  const newStatus = merged ? "merged" : "closed";

  await prisma.trackedPR.update({
    where: { prNumber },
    data: {
      status: newStatus,
      mergedAt: merged ? new Date() : null,
    },
  });

  if (merged) {
    await sendMergeEmail({
      prNumber,
      title: tracked.title,
      author: tracked.author,
      url: tracked.url,
    });
  }
}

function buildChangeSummary(
  files: { filename: string; status: string; additions: number; deletions: number }[]
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
