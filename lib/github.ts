import { Octokit } from "@octokit/rest";
import { getRepoOwnerAndName } from "./config";

let octokitInstance: Octokit | null = null;

function getOctokit(): Octokit {
  if (!octokitInstance) {
    if (!process.env.GITHUB_TOKEN) {
      throw new Error("GITHUB_TOKEN environment variable is required");
    }
    octokitInstance = new Octokit({ auth: process.env.GITHUB_TOKEN });
  }
  return octokitInstance;
}

export interface PRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface PRSummary {
  number: number;
  title: string;
  body: string;
  author: string;
  url: string;
  branch: string;
  headSha: string;
  state: string;
  merged: boolean;
  createdAt: string;
}

export async function listOpenPRs(): Promise<PRSummary[]> {
  const octokit = getOctokit();
  const { owner, repo } = getRepoOwnerAndName();

  const prs: PRSummary[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.pulls.list({
      owner,
      repo,
      state: "open",
      sort: "updated",
      direction: "desc",
      per_page: 100,
      page,
    });

    if (data.length === 0) break;

    prs.push(
      ...data.map((pr) => ({
        number: pr.number,
        title: pr.title,
        body: pr.body || "",
        author: pr.user?.login || "unknown",
        url: pr.html_url,
        branch: pr.head.ref,
        headSha: pr.head.sha,
        state: pr.state,
        merged: false,
        createdAt: pr.created_at,
      }))
    );

    if (data.length < 100) break;
    page++;
  }

  return prs;
}

export async function getPRState(
  prNumber: number
): Promise<{ state: string; merged: boolean; headSha: string; title: string }> {
  const octokit = getOctokit();
  const { owner, repo } = getRepoOwnerAndName();

  const { data } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  return {
    state: data.state,
    merged: data.merged,
    headSha: data.head.sha,
    title: data.title,
  };
}

export async function getPRFiles(prNumber: number): Promise<PRFile[]> {
  const octokit = getOctokit();
  const { owner, repo } = getRepoOwnerAndName();

  const files: PRFile[] = [];
  let page = 1;

  while (true) {
    const { data } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
      page,
    });

    if (data.length === 0) break;

    files.push(
      ...data.map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      }))
    );

    if (data.length < 100) break;
    page++;
  }

  return files;
}

export async function getPRDetails(prNumber: number) {
  const octokit = getOctokit();
  const { owner, repo } = getRepoOwnerAndName();

  const { data } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  return {
    number: data.number,
    title: data.title,
    body: data.body || "",
    author: data.user?.login || "unknown",
    url: data.html_url,
    branch: data.head.ref,
    baseBranch: data.base.ref,
    state: data.state,
    merged: data.merged,
    additions: data.additions,
    deletions: data.deletions,
    changedFiles: data.changed_files,
  };
}

export async function getFileContent(
  filePath: string,
  ref?: string
): Promise<string | null> {
  const octokit = getOctokit();
  const { owner, repo } = getRepoOwnerAndName();

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref,
    });

    if ("content" in data && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch {
    return null;
  }
}

export async function getCompareCommits(
  base: string,
  head: string
): Promise<PRFile[]> {
  const octokit = getOctokit();
  const { owner, repo } = getRepoOwnerAndName();

  const { data } = await octokit.repos.compareCommits({
    owner,
    repo,
    base,
    head,
  });

  return (data.files || []).map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch,
  }));
}
