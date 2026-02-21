import fs from "fs";
import path from "path";
import yaml from "js-yaml";

export interface TeamInterest {
  name: string;
  ownership_file: string;
}

export interface AppConfig {
  github: {
    repo: string;
  };
  interests: {
    keywords: string[];
    teams: TeamInterest[];
  };
  notifications: {
    email_to: string;
    on_new_pr: boolean;
    on_code_change: boolean;
    on_merge: boolean;
  };
}

let cachedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  const configPath = path.resolve(process.cwd(), "config.yml");
  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = yaml.load(raw) as AppConfig;

  if (!parsed.github?.repo) {
    throw new Error("config.yml: github.repo is required");
  }
  if (!parsed.interests) {
    parsed.interests = { keywords: [], teams: [] };
  }
  parsed.interests.keywords ??= [];
  parsed.interests.teams ??= [];
  parsed.notifications ??= {
    email_to: "",
    on_new_pr: true,
    on_code_change: true,
    on_merge: true,
  };

  cachedConfig = parsed;
  return parsed;
}

export function reloadConfig(): AppConfig {
  cachedConfig = null;
  return loadConfig();
}

export function getRepoOwnerAndName(): { owner: string; repo: string } {
  const config = loadConfig();
  const [owner, repo] = config.github.repo.split("/");
  return { owner, repo };
}
