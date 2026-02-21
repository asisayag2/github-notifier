import picomatch from "picomatch";
import { loadConfig } from "./config";
import { getAllTeamOwnedPaths } from "./ownership";
import type { PRFile } from "./github";

export interface MatchResult {
  isInteresting: boolean;
  reason: "keyword" | "ownership" | "both" | "none";
  matchedKeywords: string[];
  matchedTeams: { team: string; files: string[] }[];
}

export async function checkInterest(
  prTitle: string,
  prBody: string,
  prBranch: string,
  changedFiles: PRFile[]
): Promise<MatchResult> {
  const config = loadConfig();
  const matchedKeywords = findKeywordMatches(
    config.interests.keywords,
    prTitle,
    prBody,
    prBranch,
    changedFiles
  );
  const matchedTeams = await findOwnershipMatches(changedFiles);

  const hasKeywords = matchedKeywords.length > 0;
  const hasOwnership = matchedTeams.length > 0;

  let reason: MatchResult["reason"] = "none";
  if (hasKeywords && hasOwnership) reason = "both";
  else if (hasKeywords) reason = "keyword";
  else if (hasOwnership) reason = "ownership";

  return {
    isInteresting: hasKeywords || hasOwnership,
    reason,
    matchedKeywords,
    matchedTeams,
  };
}

function findKeywordMatches(
  keywords: string[],
  title: string,
  body: string,
  branch: string,
  files: PRFile[]
): string[] {
  const searchableText = [
    title,
    body,
    branch,
    ...files.map((f) => f.filename),
  ]
    .join(" ")
    .toLowerCase();

  return keywords.filter((kw) => searchableText.includes(kw.toLowerCase()));
}

async function findOwnershipMatches(
  changedFiles: PRFile[]
): Promise<{ team: string; files: string[] }[]> {
  const teamPaths = await getAllTeamOwnedPaths();
  const matches: { team: string; files: string[] }[] = [];

  for (const [team, ownedPaths] of teamPaths) {
    if (ownedPaths.length === 0) continue;

    const matchers = ownedPaths.map((p) => picomatch(p, { dot: true }));
    const matchedFiles = changedFiles
      .filter((f) => matchers.some((matcher) => matcher(f.filename)))
      .map((f) => f.filename);

    if (matchedFiles.length > 0) {
      matches.push({ team, files: matchedFiles });
    }
  }

  return matches;
}
