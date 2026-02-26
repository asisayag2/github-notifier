# GitHub PR Notifier

A polling-based agent that monitors GitHub PRs, matches them against your interest criteria (keywords + team code ownership), and sends email notifications. Includes a dashboard to track interesting PRs through to merge.

## How It Works

1. **Poller** checks the GitHub API every 2 minutes for new and updated PRs
2. **Interest Matcher** checks each PR against your configured keywords and team ownership files
3. **If interesting**: saves to database, sends an email with match details
4. **Tracks code changes** on interesting PRs and notifies you on every push until merge
5. **Dashboard** shows all tracked PRs with their status and change history

## Quick Start (Docker Compose)

### Prerequisites

- Docker and Docker Compose
- GitHub Personal Access Token (classic) with `repo` scope
- [Resend](https://resend.com) account (free tier: 100 emails/day)

### 1. Clone and configure

```bash
git clone https://github.com/asisayag2/github-notifier.git
cd github-notifier
cp .env.example .env
```

Edit `.env` with your real values:

```env
GITHUB_TOKEN=ghp_...
RESEND_API_KEY=re_...
DB_PASSWORD=choose_a_strong_password
POLL_INTERVAL_MS=120000
```

### 2. Configure interests

Edit `config.yml` to define what PRs interest you:

```yaml
github:
  repo: owner/repo-name

interests:
  keywords:
    - "breaking change"
    - "migration"
    - "accounts"
  teams:
    - name: accounts
      ownership_file: server/config/teams/accounts.yml

notifications:
  email_to: "you@example.com"
  on_new_pr: true
  on_code_change: true
  on_merge: true
```

**Keywords**: case-insensitive search in PR title, body, branch name, and changed file paths.

**Teams**: fetches the ownership YAML from the repo, extracts file path patterns, and checks if the PR touches any owned files.

### 3. Start

```bash
docker compose up -d
```

The dashboard will be at `http://localhost:3000`.

### Updating

```bash
git pull
docker compose up -d --build
```

## Deploy to EC2

1. SSH into your EC2 instance
2. Install Docker and Docker Compose
3. Clone the repo and follow the Quick Start steps above
4. (Optional) Set up a reverse proxy (nginx/caddy) in front of port 3000 for HTTPS

### Auto-start on boot (systemd)

To start the app automatically after instance reboot:

```bash
sudo cp github-notifier.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable github-notifier.service
sudo systemctl start github-notifier.service
```

The service runs `docker compose up -d` when the system boots and `docker compose down` on shutdown.

## Architecture

The app runs in two containers:

- **app** -- Next.js server + background poller
- **db** -- PostgreSQL 16

The poller runs inside the Next.js process (via `instrumentation.ts`) and polls the GitHub API at a configurable interval. No inbound internet traffic is required -- all connections are outbound to `api.github.com` and `api.resend.com`.

The webhook endpoint at `/api/webhooks/github` is still available as an optional alternative if your network allows inbound GitHub traffic.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── webhooks/github/route.ts   # Webhook endpoint (optional)
│   │   └── prs/route.ts               # REST API for dashboard
│   ├── components/                     # UI components
│   ├── pr/[id]/page.tsx               # PR detail page
│   ├── page.tsx                       # Dashboard
│   └── layout.tsx                     # Root layout
├── lib/
│   ├── config.ts                      # Config loader
│   ├── github.ts                      # GitHub API client
│   ├── interest-matcher.ts            # Interest matching logic
│   ├── ownership.ts                   # Team ownership loader
│   ├── email.ts                       # Email notifications
│   ├── poller.ts                      # Polling service
│   └── prisma.ts                      # Database client
├── prisma/schema.prisma               # Database schema
├── instrumentation.ts                 # Starts poller on server boot
├── config.yml                         # Interest configuration
├── Dockerfile                         # Multi-stage Docker build
├── docker-compose.yml                 # App + PostgreSQL
└── .env.example                       # Environment template
```
