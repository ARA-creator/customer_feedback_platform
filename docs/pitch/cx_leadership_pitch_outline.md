# Customer Pulse — CX Leadership Pitch Deck

**Audience:** CX and operations managers, team leads  
**Format:** Slide-by-slide outline with speaker notes  
**Build in:** PowerPoint or Google Slides  
**Brand:** Customer Pulse · Enterprise Life · Accent color `#009750`

Use this document as copy-paste source for slides. Capture screenshots from `https://customerpulse.vercel.app` (see [screenshot_checklist.md](./screenshot_checklist.md)).

---

## Slide 1 — Title

### On slide

**Title:** Customer Pulse

**Subtitle:** One place to see, prioritize, and act on customer feedback

**Footer:** Enterprise Life · CX & Operations Leadership Briefing · [Date]

### Speaker notes

Open with the core promise: customer feedback today arrives everywhere—email, WhatsApp, Facebook, web forms, and more. Without a single view, managers spend time hunting messages instead of improving service. Customer Pulse is Enterprise Life’s unified feedback command center: one dashboard, one inbox, one source of truth for what customers are saying and what needs action first.

**Opening line (optional):** “Before we look at the product, ask yourself: how long would it take your team to answer three questions—how many negative messages this week, what’s the top complaint theme, and which channel is spiking?”

---

## Slide 2 — The problem managers face today

### On slide

**Headline:** Feedback is everywhere. Visibility is not.

**Bullets:**

- Feedback is scattered across email inboxes, social DMs, form submissions, and ad-hoc spreadsheets
- No shared view of volume, sentiment, or trending issues
- Hard to prioritize: urgent complaints look the same as routine messages
- Reporting upward is manual—screenshots, exports, and guesswork
- Teams work in silos; no single queue for triage and follow-up

**Visual:** Split-screen diagram—left: 6+ disconnected channels (Email, WhatsApp, Facebook, JotForm, etc.); right: three questions (“What’s trending?” · “Who owns this?” · “Is it getting worse?”)

### Speaker notes

Speak to daily operational pain, not abstract “digital transformation.” Managers already know feedback exists—they do not have a reliable way to measure it, compare channels, or prove improvement to leadership.

Pause after the three questions. Let the room acknowledge the gap. This slide sets up why a dashboard matters: not for technology’s sake, but because CX leadership cannot run a team or report confidently without shared metrics.

---

## Slide 3 — What Customer Pulse is

### On slide

**Headline:** A multi-channel feedback command center for CX and operations teams

**One-liner:** Customer Pulse collects feedback from every channel, analyzes it consistently, and gives your team one place to triage, prioritize, and report.

**Three pillars:**

| Pillar | What it means |
|--------|----------------|
| **Centralize** | All channels into one inbox and database |
| **Analyze** | Dashboard KPIs, themes, peak times, AI summaries |
| **Act** | Triage, assign, track, export for leadership reporting |

### Speaker notes

Position Customer Pulse as operational infrastructure, not a side tool or “another inbox.” Whether feedback came from JotForm, email, or Facebook, it lands in the same system with the same sentiment labels, priority scores, and theme tags. That consistency is what makes weekly reviews and cross-channel comparison possible.

Avoid over-promising on channels still in rollout—see Slide 12 for honest status.

---

## Slide 4 — How it works (4 steps)

### On slide

**Headline:** From scattered messages to closed loop

| Step | Headline | Manager benefit |
|------|----------|-----------------|
| 1 | **Centralize feedback** | Stop checking 5+ systems |
| 2 | **Analyze & prioritize** | See themes, channels, and peak load at a glance |
| 3 | **Collaborate & act** | Shared inbox, read/unread, Customer 360 |
| 4 | **Close the loop** | Alerts, approvals, timely follow-up |

**Visual:** Simple left-to-right flow: Customer → Channel → Customer Pulse → Team action → Reporting

### Speaker notes

Walk through one concrete journey: a customer posts a billing complaint on Facebook → webhook ingests it → inbox flags it negative and high priority → team lead assigns to an agent → item is resolved → same record appears in weekly CSV export for leadership.

This mirrors the in-app “How it works” narrative in Settings → Help. Emphasize that steps 2 and 4 are where managers get value—Overview and Insights for analysis, Reports for upward communication.

---

## Slide 5 — Overview dashboard (manager’s home screen)

### On slide

**Headline:** Overview — answer “how are we doing?” in under 60 seconds

**What managers see:**

- **Time filters:** Today · This Week · Last Week · This Month · All Time
- **Sentiment filters:** All · Positive · Negative · Neutral
- **KPI cards (clickable → opens filtered Inbox):**
  - Total Feedback
  - Negative / Positive / Neutral (with share bars)
- **Charts:** Sentiment trend · Volume by channel · Product breakdown · Top feedback topics · Recent feedback feed
- **AI Insight bar:** Gemini-powered summary with Refresh

**Manager value:**

- One screen for weekly standups and leadership check-ins
- Click any KPI to see the exact messages behind the number
- Export CSV for analyst-ready leadership packs (one row per feedback)

**Screenshot:** `screenshots/01-overview-this-week.png`

### Speaker notes

This is the slide team leads will use every Monday. Stress that KPI cards are not vanity metrics—each is clickable and opens the Inbox with that filter applied. “140 negative this week” becomes a list you can assign, not a number you have to explain without evidence.

Mention **Export CSV** on Overview: same tidy format as Reports, scoped to current time and sentiment filters. No more rebuilding Excel from screenshots.

If asked about “All Time” vs Inbox totals: both should align when filters match; Overview KPIs respect the selected time window.

---

## Slide 6 — Insights (strategic view)

### On slide

**Headline:** Insights — understand *why* the numbers moved

**What leaders use for pattern-spotting:**

- **Insight Brief** — executive summary banner with theme and source chips
- **Theme Landscape** — what customers talk about most
- **Channel Monitors** — which source is noisy or problematic
- **Source × Theme Matrix** — hotspots (e.g. Facebook + billing complaints)
- **Peak feedback times** — day/hour heatmap for staffing decisions
- **Top negative issues** — bar chart of urgent themes
- **Investigate bar** — apply filters and jump straight to Inbox

**Manager value:**

- Spot spikes before they become crises
- Align rosters to peak hours
- Compare channels: “Is WhatsApp happier than email?”

**Screenshot:** `screenshots/02-insights-matrix-or-peak-times.png`

### Speaker notes

Differentiate Overview vs Insights clearly:

- **Overview** = pulse check (“what happened this week?”)
- **Insights** = diagnosis (“why, where, and when?”)

Insights is reached from Overview charts or the AI bar—not a separate sidebar item—so train managers on the path: Overview → “View insights” or chart drill-down.

The **Investigate** bar is powerful for managers: pick theme + channel + negative-only, then open Inbox with those filters pre-applied.

---

## Slide 7 — Unified Inbox (where teams work)

### On slide

**Headline:** One inbox for every channel

**Day-to-day triage:**

- **Folders:** Inbox · Archive
- **Tabs:** All · Read · Unread (with counts)
- **Filters:** Search, sentiment, channel, theme, date range
- **Sidebar cards:** Trending topic · High priority · Avg peak hours · New feedback
- **Quick filters:** Unread · Needs response · High priority · Negative (7d)
- **Actions:** Sort newest/oldest/priority · Bulk mark read · Pin items
- **Detail view:** Policy/product matching · Customer 360 · Sentiment + priority score

**Channels in one list:** Email · Web · JotForm · WhatsApp · Facebook · Instagram · X · TikTok

**Manager value:**

- One queue for the whole team—no “check Facebook separately”
- Priority scoring surfaces urgent items first
- Customer 360 shows history when the same person contacts via multiple channels

**Screenshot:** `screenshots/03-inbox-sidebar-filters.png`

### Speaker notes

Agents live here; managers care that nothing falls through and supervisors can spot backlog via unread and high-priority counts. Sidebar summary cards give a quick operational snapshot without opening Insights.

**Read/Unread tabs** filter server-side—counts and list stay in sync. Mention keyboard shortcuts (⌘K search, j/k navigation) for power users.

Archive is client-side (browser storage)—good for personal cleanup, not compliance retention. For audit needs, use Reports export and admin activity logs.

---

## Slide 8 — Smart prioritization and insurance context

### On slide

**Headline:** Built for insurance CX—not generic social listening

**Automatic on every message:**

- **Sentiment analysis** — tuned for insurance language (claims, payouts, delays, lapses)
- **Priority scoring** — sentiment, recency, channel reach, customer value, existing priority
- **Theme tagging** — claims, billing, premiums, policy, support, digital, speed/delivery delays, trust & fairness, etc.
- **Policy detection** — policy numbers linked to product groups (masked for privacy)

**Manager value:**

- Negative claims-related feedback rises to the top without manual tagging
- Themes roll up consistently—“47 ways to say billing problem” becomes one category
- Product breakdown shows which insurance lines drive complaints

### Speaker notes

This slide explains why Enterprise Life built Customer Pulse instead of buying a generic tool. Insurance vocabulary matters: “claim delayed” and “payout pending” carry different weight than generic positive/negative classifiers.

Priority is composite—not just sentiment. A neutral but recent message on a high-reach channel may still rank above an old positive review.

Two agents will not classify the same message differently—the platform applies the same rules on ingest.

---

## Slide 9 — AI assistant for CX leaders

### On slide

**Headline:** AI briefing—not AI autopilot

**Gemini-powered Overview analyzer:**

- Summary of what customers are saying this period
- Key themes, sentiment insights, risks, recommendations
- Grounded in actual feedback data in your database
- Rule-based fallback if AI is unavailable

**When managers use it:**

- Monday standup prep
- Drafting a note for senior leadership
- Validating “gut feel” with data before escalating

**Screenshot (optional):** `screenshots/07-overview-ai-insight-bar.png`

### Speaker notes

Frame AI as a **briefing assistant**, not a replacement for judgment. Managers still decide; AI compresses reading time across hundreds of messages.

Production health: `/api/health` exposes `gemini.ready`—if false, Overview still works; summary falls back to rules.

Do not oversell: AI summarizes what is already ingested. If Facebook is not connected, AI cannot invent those messages.

---

## Slide 10 — Reports and exports

### On slide

**Headline:** Stop rebuilding Excel every Friday

**Export options:**

- **Overview → Export CSV** — respects current time and sentiment filters
- **Reports → Custom export** — sentiment, priority, source, category, date range, limit
- **Insights → Export** — JSON snapshot (metrics, brief, matrix, trends)

**Analyst CSV columns (one row per feedback):**

feedback_id · date_received · channel · customer_segment · sentiment · priority · theme · category · feedback_text · assigned_to · status · response_time_hours · resolution_time_hours · escalation_flag

**Scheduled reports:** UI supports daily/weekly/monthly definitions; email/Slack delivery can be connected in a later phase

**Screenshot:** `screenshots/05-reports-custom-export.png`

### Speaker notes

Stress **one row per feedback**—designed for Excel pivot tables and Power BI, not dashboard-style Section/Key/Value dumps.

Reports page requires appropriate permissions (`reports.view_org`, `reports.export`, or admin roles). Analysts can export without reply permissions.

For compliance packs: combine CSV export with Admin → User activity audit trail.

---

## Slide 11 — Team roles and governance

### On slide

**Headline:** The right access for each role

| Role | Who | What they get |
|------|-----|---------------|
| **Agent** | Frontline responders | Assigned queue, reply, resolve |
| **Team Lead** | Supervisors | Team queue, assign, approve replies |
| **Analyst** | CX/product analysts | View all, export, Customer 360 (read-focused) |
| **CX Manager** | Operations leadership | Cross-team view, automation, reports |
| **Auditor** | Compliance | Read-only + activity logs |
| **Super Admin** | Platform owner | Full access |

**Governance:**

- Enterprise SSO (Azure AD) for staff
- Partner/contractor signup with admin approval
- Audit trail: signups, role changes, admin actions

### Speaker notes

Reassure leadership that access is controlled. Agents do not see org-wide data unless permitted; analysts can export without replying; auditors are read-only.

Enterprise email domains (`enterprisegroup.net.gh`, `enterprise-life.com`) map to SSO; external partners go through signup + approval workflow.

Role mapping from Azure AD groups is configurable (e.g. “CX Managers” → `cx_manager`).

---

## Slide 12 — Channels connected

### On slide

**Headline:** Multi-channel by design—rollout by priority

| Channel | How it ingests | Status note |
|---------|----------------|-------------|
| Email (IMAP) | Scheduled poll (cron) | Production-ready |
| JotForm | Webhook | Production-ready |
| WhatsApp (Twilio / Meta) | Webhook | Configure credentials |
| Facebook / Instagram | Meta webhooks | App review for full production |
| Web forms | Native channel | Production-ready |
| X (Twitter) | Recent-search poll | Manual poll available |
| TikTok | Configured in admin | Per integration setup |

**Honesty note:** Meta apps in Development mode only receive events from Testers until the app is Live and reviewed.

**Screenshot:** `screenshots/06-admin-channels-grid.png`

### Speaker notes

Be transparent: the **architecture is ready**; rollout is configuration, credentials, and governance—not a rebuild. Social channels especially need Meta app review before all customers’ comments and DMs flow in.

Assign **channel owners** in the room: who owns Facebook credentials, who owns email IMAP, who validates JotForm webhook secret.

Phase rollout: email + forms first (low friction), then WhatsApp, then Facebook/Instagram after Meta production approval.

---

## Slide 13 — Business outcomes

### On slide

**Headline:** What changes for CX leadership

| Outcome | How Customer Pulse delivers |
|---------|----------------------------|
| **Faster response** | Unified queue + priority scoring = less time hunting messages |
| **Earlier detection** | Sentiment spikes and theme trends visible before escalation |
| **Better staffing** | Peak-hour heatmaps inform rosters |
| **Consistent reporting** | One source of truth for weekly/monthly CX reviews |
| **Customer continuity** | Customer 360 across channels |
| **Audit readiness** | Exportable history + user activity logs |

**90-day pilot targets (fill in your baselines):**

- Reduce time-to-first-response by ___%
- Cut manual reporting hours from ___ to ___ per week
- Increase % of feedback triaged within SLA from ___ to ___

### Speaker notes

If you lack baseline numbers today, frame these as **pilot success criteria**, not invented ROI. Offer to measure week 1 vs week 12 during a controlled rollout on one or two channels.

Tie outcomes to slides they have already seen: Overview for reporting cadence, Insights for staffing, Inbox for response time, Reports for audit.

---

## Slide 14 — Live demo + the ask

### On slide

**Headline:** See it live — then decide next steps

**Demo flow (5–7 min):** See [demo_script.md](./demo_script.md)

**The ask (customize for your meeting):**

1. Approve a 90-day pilot with [team / channel list]
2. Assign channel owners (Facebook, WhatsApp, email, JotForm)
3. Agree weekly KPI review cadence using Overview
4. Support Meta app review and production credentials for social channels
5. Nominate team leads and analysts for role setup in Admin → Users

**Contact / next meeting:** [Your name · date for follow-up]

### Speaker notes

End with a **concrete next step**, not “any questions?” alone. Example: “Can we agree today on email + JotForm as Phase 1 and schedule a 30-minute setup session next week?”

Leave one-page summary ([manager_summary.md](./manager_summary.md)) for attendees who miss the demo.

---

## Appendix slides (optional — Q&A backup)

### A1 — Security and access

- Azure AD SSO for enterprise staff
- RBAC with granular permissions (feedback, customer, reports, admin)
- Encrypted sensitive fields; policy numbers masked in UI
- Rate limiting on authentication
- Admin → User activity audit trail

### A2 — Architecture (simple)

```text
Customer → External platform (Email, Meta, JotForm, etc.)
         → Integration layer (webhooks / poll)
         → Database (Postgres / Neon)
         → Customer Pulse dashboard (Overview · Insights · Inbox · Reports)
```

Hosted on Vercel; API at `/api`; production URL `customerpulse.vercel.app`.

### A3 — Implementation timeline

| Phase | Scope | Duration |
|-------|--------|----------|
| 1 | Email + JotForm + web; core team roles | Weeks 1–4 |
| 2 | WhatsApp; weekly Overview cadence | Weeks 5–8 |
| 3 | Facebook/Instagram (post Meta review); full export automation | Weeks 9–12 |

### A4 — FAQ

**Does this replace our CRM?**  
No. Customer Pulse complements CRM—it focuses on inbound feedback triage, multi-channel visibility, and CX analytics. CRM remains system of record for sales/service cases where applicable.

**Can we export for compliance?**  
Yes. Analyst CSV export plus audit logs. Define retention policy with IT/compliance separately.

**What if AI is down?**  
Dashboard, Inbox, and rule-based sentiment continue. AI summary falls back to deterministic rules.

**Who can see all feedback?**  
Roles with `feedback.view_all` or equivalent—typically analysts, CX managers, and admins. Agents see assigned or team queues only.

---

## Presentation tips

- **Length:** 20–25 minutes presenting + 5–7 minute demo + Q&A
- **Slides:** One idea per slide; max 5 bullets
- **Visuals:** App screenshots over stock photos; use brand green `#009750` for accents
- **Prep:** Log in as a user with Overview + Reports access; pre-select “This Week” before demo
- **Backup:** If live demo fails, use screenshots from [screenshot_checklist.md](./screenshot_checklist.md)
