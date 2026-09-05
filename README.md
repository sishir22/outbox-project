# 🚀 ReachInbox.ai Full-Stack Email Job Scheduler & Dashboard

A production-grade, distributed email scheduling service and dashboard built with **Node.js, TypeScript, Express, BullMQ, Redis, MySQL (Prisma), Elasticsearch, Ethereal SMTP, Next.js, and Tailwind CSS**.

This project implements reliable, persistent email scheduling without cron jobs, worker concurrency, atomic sliding-window rate limiting per sender, automatic rescheduling, Slack OAuth alerts on quota exhaustion, full-text search with Elasticsearch, and a live BullMQ queue dashboard.

---

## 🏗 System Architecture & Design

```text
                           ┌────────────────────────┐
                           │   Next.js Dashboard    │
                           │  (React, Tailwind CSS) │
                           └───────────┬────────────┘
                                       │ HTTP / REST
                                       ▼
                           ┌────────────────────────┐
                           │   Express.js Backend   │
                           │   (API & Controller)   │
                           └──────┬──────────┬──────┘
              1. Save to DB       │          │ 2. Push Delayed Job
                    ┌─────────────┘          └──────────────┐
                    ▼                                       ▼
         ┌─────────────────────┐                 ┌─────────────────────┐
         │       MySQL         │                 │    Redis Cluster    │
         │  (Source of Truth)  │                 │ (BullMQ Data Store) │
         └──────────▲──────────┘                 └──────────┬──────────┘
                    │                                       │ 3. BullMQ pulls
                    │ 5. Update status (SENT/FAILED)        │    when timestamp hits
                    │                                       ▼
                    │                            ┌─────────────────────┐
                    └────────────────────────────┤   BullMQ Worker     │
                                                 │ (Rate Limiter Engine│
                                                 └────┬──────┬──────┬──┘
                   4a. Rate Limit Reached?            │      │      │ 4c. Send Email
           ┌──────────────────────────────────────────┘      │      └──────────────┐
           ▼                                                 ▼                     ▼
 ┌──────────────────┐                               ┌─────────────────┐   ┌────────────────┐
 │ Slack Webhook API│                               │  Elasticsearch  │   │ Ethereal SMTP  │
 │(OAuth Alert Bot) │                               │ (Search Index)  │   │  (Nodemailer)  │
 └──────────────────┘                               └─────────────────┘   └────────────────┘
```

---

## 🔑 Core Technical Decisions & Concepts

### 1. No-Cron Persistent Scheduling with BullMQ & Redis
- **Why No Cron?** Traditional cron jobs poll databases every minute (`SELECT * FROM emails WHERE scheduled_at <= NOW()`), which hammers the database under load, introduces thundering-herd race conditions across multiple server replicas, and limits precision to 60 seconds.
- **The BullMQ Solution:** BullMQ leverages Redis **Sorted Sets (`ZSET`)**. When an email is scheduled, BullMQ adds the job ID to a Redis `ZSET` where the `score` is the execution timestamp in milliseconds ($O(\log N)$ lookup time).
- **Persistence Across Server Restarts:** Redis is configured with `appendonly yes` (AOF persistence). Even if the Express server or Worker crashes completely, Redis persists the scheduled timestamps. Upon restarting, BullMQ automatically resumes delayed jobs without restarting from scratch or duplicating sends.
- **Thin Job Pattern:** The queue stores only `{ emailId: string }`. When the worker wakes up, it queries MySQL for authoritative current state. This allows instant cancellations, dynamic subject edits, and updated sender credentials without migrating queued Redis jobs.

### 2. Rate Limiting & Concurrency Architecture
- **Worker Concurrency:** BullMQ worker runs with a configurable concurrency level (`WORKER_CONCURRENCY=5`), safely processing jobs in parallel across multiple CPU cores or instances.
- **Inter-Email Delay (Pacing):** When a batch is scheduled, the backend staggers the initial `scheduled_at` timestamp:
  $$\text{scheduledAt}_i = \text{startTime} + (i \times \text{delayBetweenEmailsMs})$$
- **Hourly Quota per Sender:** Enforced via atomic Redis counters:
  `ratelimit:sender:{senderId}:{hourWindowKey}`
  Each email atomically calls `redis.incr()`. If the counter exceeds the sender's limit:
  1. The email is **not dropped or failed**.
  2. The remaining delay until the next hour window is calculated:
     $$\text{retryAfterMs} = \text{NextHourMark} - \text{Date.now()}$$
  3. The job is rescheduled in BullMQ with `delay = retryAfterMs`, and the database `scheduledAt` is updated.
- **Slack Alert Deduplication:** To prevent spamming the user's Slack channel with hundreds of duplicate messages when a batch exceeds quota, the worker uses atomic `SET ... NX` in Redis:
  `ratelimit:alerted:sender:{senderId}:{hourKey}`
  Only the first email hitting the quota triggers the Slack webhook in that hour window.

### 3. Full-Text Search with Elasticsearch
- When emails are scheduled or sent, they are synchronized to an Elasticsearch index (`emails`).
- Search queries execute multi-match full-text searches with fuzziness across `subject`, `recipientEmail`, and `body`.

### 4. Live BullMQ Visibility Dashboard
- Real-time Bull Board is mounted at `http://localhost:5000/admin/queues`, exposing live counts of active, delayed, waiting, completed, and failed jobs.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Backend Framework** | Node.js, Express.js, TypeScript |
| **Job Queue & Broker** | BullMQ, Redis 7 (AOF enabled) |
| **Relational Database** | MySQL 8.0 with Prisma ORM |
| **Search Engine** | Elasticsearch 8.11 |
| **SMTP / Email Delivery** | Nodemailer with Ethereal Email (fake SMTP) |
| **Queue Visibility** | Bull Board (`@bull-board/express`) |
| **Frontend Dashboard** | Next.js 14 (App Router), React 18, Tailwind CSS, Lucide Icons |

---

## 🚀 Quick Start Guide

### Prerequisites
- [Docker Desktop](https://www.docker.com/) installed and running
- [Node.js](https://nodejs.org/) v18+ or v20+

### 1. Start Infrastructure (Docker)
In the project root directory:
```bash
docker compose up -d
```
This spins up:
- **MySQL 8.0** on `localhost:3306`
- **Redis 7 (Alpine with AOF)** on `localhost:6379`
- **Elasticsearch 8.11** on `localhost:9200`

### 2. Run Backend
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```
The backend starts at:
- **API Server:** `http://localhost:5000/api`
- **BullMQ Live Queue Board:** `http://localhost:5000/admin/queues`
- **Health Check:** `http://localhost:5000/health`

*(Note: If no Ethereal credentials are provided in `.env`, the backend automatically generates a disposable test Ethereal account on the fly and logs the web inbox link to the console).*

### 3. Run Frontend
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:3000`** in your browser to view the dashboard matching the Figma design.

---

## 📋 Features Implemented

### Backend Features
- [x] **Core Scheduler:** Persistent delayed scheduling via BullMQ and Redis (No cron jobs).
- [x] **Relational Persistence:** MySQL tables for `users`, `senders`, `slack_integrations`, `email_batches`, `emails`, and `attachments`.
- [x] **Fault Tolerance on Restart:** Jobs resume at their exact timestamp if the server or worker is stopped and restarted.
- [x] **Worker Concurrency:** Multi-worker concurrency (`WORKER_CONCURRENCY=5`).
- [x] **Multi-Sender Support:** Configurable senders per user with separate SMTP credentials and quotas.
- [x] **Configurable Throttling:** Minimum delay between emails (e.g. 2s) and hourly quota limits.
- [x] **Hourly Rate Limiter:** Atomic Redis sliding window counter; auto-reschedules into next hour window without dropping jobs.
- [x] **Slack Integration:** OAuth connection flow + live webhook notification triggered upon rate limit hit.
- [x] **Elasticsearch Full-Text Search:** Real-time indexing and search across subject, recipient, and body.
- [x] **BullMQ Dashboard:** Live queue monitoring UI mounted at `/admin/queues`.
- [x] **CSV Lead Parsing API:** Extracts and deduplicates email addresses from uploaded CSVs.

### Frontend Features (Matching Figma Design)
- [x] **Google Login Screen (`/login`):** Centered card with Google OAuth and email/password form (Figma Image 1).
- [x] **Unified Sidebar:** Oliver Brown user profile card, Compose action, Scheduled & Sent navigation with dynamic badges, Slack connection status, and Bull Board link (Figma Image 2 & 3).
- [x] **Scheduled Emails View:** Search bar, filter/refresh controls, rows with orange timestamp pills and subject previews (Figma Image 3).
- [x] **Sent Emails View:** Status pills, sent timestamps, and direct link to Ethereal webmail preview (Figma Image 2).
- [x] **Email Detail Thread View:** Sender avatar, recipient details, timestamp, rich HTML body, and Ethereal preview banner (Figma Image 4).
- [x] **Compose New Email (`ComposeModal`):** From dropdown, To input, CSV lead upload with badge count, Delay between emails, Hourly limit, rich text editor toolbar, and "Send Later" popover with date-time picker and presets (Tomorrow, 10 AM, 11 AM, 3 PM) (Figma Image 5).

---

## 🧪 Testing Scenarios for Submission

### 1. Creating Scheduled Emails
1. Open `http://localhost:3000`.
2. Click **Compose**.
3. Enter a recipient (or upload a `.csv` lead list), subject, and body.
4. Set inter-email delay (e.g. `2` seconds) and click the **Clock** icon to select a future time.
5. Click **Schedule**.
6. Switch to the **Scheduled** tab to see your queued email.
7. Open `http://localhost:5000/admin/queues` to see the job waiting in BullMQ's `Delayed` queue.

### 2. Verifying Server Restart Persistence
1. Schedule an email for 3 minutes in the future.
2. Verify it is visible in the **Scheduled** tab and in BullMQ delayed jobs.
3. Stop the backend server process (`Ctrl + C` in the backend terminal).
4. Wait 30 seconds, then restart the backend (`npm run dev`).
5. Notice the job is still intact in Redis and sends at the exact scheduled time without being lost or duplicated!

### 3. Verifying Ethereal Email Delivery
1. Schedule an email with `delay = 0` (instant send).
2. Wait a few seconds, switch to the **Sent** tab.
3. Click the email row or click the **Ethereal** link to view the actual rendered email in the Ethereal webmail sandbox!
