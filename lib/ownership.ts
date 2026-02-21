import yaml from "js-yaml";
import { getFileContent } from "./github";
import { loadConfig, type TeamInterest } from "./config";

interface OwnershipData {
  paths: string[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const ownershipCache = new Map<string, OwnershipData>();

export async function getTeamOwnedPaths(team: TeamInterest): Promise<string[]> {
  const cached = ownershipCache.get(team.name);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.paths;
  }

  const content = await getFileContent(team.ownership_file);
  if (!content) {
    console.warn(
      `Could not fetch ownership file for team ${team.name}: ${team.ownership_file}`
    );
    return [];
  }

  const parsed = yaml.load(content) as Record<string, unknown>;
  const paths = extractPaths(parsed);

  ownershipCache.set(team.name, { paths, fetchedAt: Date.now() });
  return paths;
}

function extractPaths(data: unknown): string[] {
  const paths: string[] = [];

  if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === "string") {
        paths.push(item);
      } else {
        paths.push(...extractPaths(item));
      }
    }
  } else if (data && typeof data === "object") {
    for (const value of Object.values(data as Record<string, unknown>)) {
      paths.push(...extractPaths(value));
    }
  }

  return paths;
}

export async function getAllTeamOwnedPaths(): Promise<
  Map<string, string[]>
> {
  const config = loadConfig();
  const result = new Map<string, string[]>();

  await Promise.all(
    config.interests.teams.map(async (team) => {
      const paths = await getTeamOwnedPaths(team);
      result.set(team.name, paths);
    })
  );

  return result;
}
