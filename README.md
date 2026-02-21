# GitHub PR Notifier

A webhook-driven agent that monitors GitHub PRs, matches them against your interest criteria (keywords + team code ownership), and sends email notifications. Includes a dashboard to track interesting PRs through to merge.

## How It Works

1. **GitHub sends webhook events** when PRs are opened, updated, or closed
2. **Interest Matcher** checks the PR against your configured keywords and team ownership files
3. **If interesting**: saves to database, sends an email with match details
4. **Tracks code changes** on interesting PRs and notifies you on every push until merge
5. **Dashboard** shows all tracked PRs with their status and change history

## Setup

### Prerequisites

- Node.js 20+
- PostgreSQL database
- GitHub Personal Access Token (classic) with `repo` scope
- [Resend](https://resend.com) account (free tier: 100 emails/day)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### 3. Configure Interests

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

**Teams**: fetches the ownership YAML from the repo (e.g., `server/config/teams/accounts.yml`), extracts file path patterns, and checks if the PR touches any owned files.

### 4. Set Up Database

```bash
npx prisma migrate dev --name init
```

### 5. Run Locally

```bash
npm run dev
```

The dashboard will be at `http://localhost:3000`.

### 6. Set Up GitHub Webhook

In your GitHub repository settings:

1. Go to **Settings > Webhooks > Add webhook**
2. **Payload URL**: `https://your-domain.com/api/webhooks/github`
3. **Content type**: `application/json`
4. **Secret**: same value as your `WEBHOOK_SECRET`
5. **Events**: select "Pull requests"

For local development, use [ngrok](https://ngrok.com) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) to expose your local server.

## Deploy to Railway

1. Push your code to a Git repository
2. Create a new project on [Railway](https://railway.app)
3. Add a **PostgreSQL** plugin
4. Connect your repository
5. Set environment variables in Railway dashboard
6. Railway will auto-detect Next.js and deploy

The build command is `npm run build` and the start command is `npm start` (Railway handles this automatically).

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── webhooks/github/route.ts   # Webhook endpoint
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
│   └── prisma.ts                      # Database client
├── prisma/schema.prisma               # Database schema
└── config.yml                         # Interest configuration
```
