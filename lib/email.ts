import nodemailer from "nodemailer";
import { loadConfig } from "./config";
import type { MatchResult } from "./interest-matcher";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!user || !pass) {
      throw new Error("SMTP_USER and SMTP_PASS environment variables are required for Gmail");
    }
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user, pass },
    });
  }
  return transporter;
}

interface NewPREmailData {
  prNumber: number;
  title: string;
  body: string;
  author: string;
  url: string;
  branch: string;
  matchResult: MatchResult;
  filesChanged: number;
  additions: number;
  deletions: number;
}

export async function sendNewPREmail(data: NewPREmailData): Promise<void> {
  const config = loadConfig();
  if (!config.notifications.on_new_pr) return;

  const transport = getTransporter();
  const matchDetails = formatMatchDetails(data.matchResult);
  const from = process.env.SMTP_USER!;

  await transport.sendMail({
    from: `GitHub Notifier <${from}>`,
    to: config.notifications.email_to,
    subject: `[PR Notifier] Interesting PR #${data.prNumber}: ${data.title}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e; border-bottom: 2px solid #e94560; padding-bottom: 8px;">
          New Interesting PR Detected
        </h2>
        
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #666; width: 120px;">PR</td>
            <td style="padding: 8px;"><a href="${data.url}" style="color: #0366d6;">#${data.prNumber} - ${data.title}</a></td>
          </tr>
          <tr style="background: #f6f8fa;">
            <td style="padding: 8px; font-weight: bold; color: #666;">Author</td>
            <td style="padding: 8px;">${data.author}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; color: #666;">Branch</td>
            <td style="padding: 8px;"><code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">${data.branch}</code></td>
          </tr>
          <tr style="background: #f6f8fa;">
            <td style="padding: 8px; font-weight: bold; color: #666;">Changes</td>
            <td style="padding: 8px;">
              ${data.filesChanged} files 
              <span style="color: #28a745;">+${data.additions}</span> 
              <span style="color: #d73a49;">-${data.deletions}</span>
            </td>
          </tr>
        </table>

        ${formatPRBody(data.body) ? `
        <div style="margin: 16px 0;">
          <strong style="color: #666;">Description</strong>
          <div style="background: #f6f8fa; border-radius: 6px; padding: 12px; margin-top: 8px; font-size: 14px; line-height: 1.5; overflow-wrap: break-word;">${formatPRBody(data.body)}</div>
        </div>
        ` : ""}

        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px; margin: 16px 0;">
          <strong>Why this is interesting:</strong>
          ${matchDetails}
        </div>

        <a href="${data.url}" style="display: inline-block; background: #0366d6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 8px;">
          View PR on GitHub
        </a>
      </div>
    `,
  });
}

interface CodeChangeEmailData {
  prNumber: number;
  title: string;
  url: string;
  commitSha: string;
  filesChanged: string[];
  diffStats: string;
  summary: string;
}

export async function sendCodeChangeEmail(
  data: CodeChangeEmailData
): Promise<void> {
  const config = loadConfig();
  if (!config.notifications.on_code_change) return;

  const transport = getTransporter();
  const from = process.env.SMTP_USER!;

  const filesList = data.filesChanged
    .slice(0, 20)
    .map((f) => `<li><code>${f}</code></li>`)
    .join("");
  const truncated =
    data.filesChanged.length > 20
      ? `<li>...and ${data.filesChanged.length - 20} more</li>`
      : "";

  await transport.sendMail({
    from: `GitHub Notifier <${from}>`,
    to: config.notifications.email_to,
    subject: `[PR Notifier] Changes in PR #${data.prNumber}: ${data.title}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a2e; border-bottom: 2px solid #f39c12; padding-bottom: 8px;">
          Code Changes in Tracked PR
        </h2>
        
        <p><a href="${data.url}" style="color: #0366d6;">#${data.prNumber} - ${data.title}</a></p>
        
        <div style="background: #f6f8fa; border-radius: 6px; padding: 12px; margin: 16px 0;">
          <strong>Commit:</strong> <code>${data.commitSha.substring(0, 7)}</code><br/>
          <strong>Stats:</strong> ${data.diffStats}
        </div>

        <h3>Changed Files</h3>
        <ul style="font-size: 14px;">${filesList}${truncated}</ul>

        <h3>Summary</h3>
        <p style="background: #f6f8fa; padding: 12px; border-radius: 6px;">${data.summary}</p>

        <a href="${data.url}" style="display: inline-block; background: #0366d6; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 8px;">
          View PR on GitHub
        </a>
      </div>
    `,
  });
}

interface MergeEmailData {
  prNumber: number;
  title: string;
  author: string;
  url: string;
}

export async function sendMergeEmail(data: MergeEmailData): Promise<void> {
  const config = loadConfig();
  if (!config.notifications.on_merge) return;

  const transport = getTransporter();
  const from = process.env.SMTP_USER!;

  await transport.sendMail({
    from: `GitHub Notifier <${from}>`,
    to: config.notifications.email_to,
    subject: `[PR Notifier] PR #${data.prNumber} merged: ${data.title}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745; border-bottom: 2px solid #28a745; padding-bottom: 8px;">
          PR Merged
        </h2>
        
        <p style="font-size: 18px;">
          <a href="${data.url}" style="color: #0366d6;">#${data.prNumber} - ${data.title}</a>
          has been merged.
        </p>
        
        <p><strong>Author:</strong> ${data.author}</p>
        
        <a href="${data.url}" style="display: inline-block; background: #28a745; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-top: 8px;">
          View Merged PR
        </a>
      </div>
    `,
  });
}

function formatPRBody(body: string): string {
  if (!body.trim()) return "";
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const withBreaks = escaped.replace(/\n/g, "<br>");
  const maxLen = 3000;
  const truncated = withBreaks.length > maxLen
    ? withBreaks.slice(0, maxLen) + "<br><em>… (truncated)</em>"
    : withBreaks;
  return truncated;
}

function formatMatchDetails(match: MatchResult): string {
  const parts: string[] = [];

  if (match.matchedKeywords.length > 0) {
    parts.push(
      `<br/><strong>Keywords matched:</strong> ${match.matchedKeywords.map((k) => `<code>${k}</code>`).join(", ")}`
    );
  }

  if (match.matchedTeams.length > 0) {
    for (const tm of match.matchedTeams) {
      const fileList = tm.files.slice(0, 5).join(", ");
      const more = tm.files.length > 5 ? ` (+${tm.files.length - 5} more)` : "";
      parts.push(
        `<br/><strong>Team "${tm.team}" owns files:</strong> ${fileList}${more}`
      );
    }
  }

  return parts.join("");
}
