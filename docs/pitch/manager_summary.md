# Customer Pulse — Manager Summary (One Page)

**Enterprise Life · CX & Operations · Leave-behind / email attachment**

---

## What it is

**Customer Pulse** is Enterprise Life’s multi-channel customer feedback platform. It collects messages from email, web forms, JotForm, WhatsApp, Facebook, Instagram, and other channels into **one dashboard and one inbox**—so CX and operations managers can see volume, sentiment, and trending issues without checking five different systems.

**Production URL:** https://customerpulse.vercel.app

---

## The problem

| Today | With Customer Pulse |
|-------|---------------------|
| Feedback scattered across inboxes and social accounts | Single unified inbox |
| No shared view of negative volume or themes | Overview KPIs + Insights analytics |
| Manual weekly reporting in Excel | One-click CSV export (one row per feedback) |
| Urgent complaints buried in routine messages | Automatic sentiment + priority scoring |
| Same customer, multiple channels—no linked history | Customer 360 across touchpoints |

---

## Four capabilities managers use most

1. **Overview** — Weekly pulse: total feedback, negative/positive split, channel volume, AI summary. Click any KPI to open the underlying messages.

2. **Insights** — Diagnosis: theme trends, channel monitors, source×theme hotspots, peak-hour heatmaps for staffing.

3. **Inbox** — Team triage: read/unread tabs, filters by channel/sentiment/theme, sidebar cards (trending topic, high priority, new feedback).

4. **Reports** — Analyst-ready CSV export for leadership packs and compliance; filter by date, sentiment, priority, and source.

---

## Built for insurance CX

- Sentiment analysis tuned for claims, payouts, billing, and policy language  
- Automatic theme tagging (claims, billing, premiums, support, delivery delays, etc.)  
- Policy number detection linked to product groups (masked in UI)  
- Role-based access: agents, team leads, analysts, CX managers, auditors  

---

## Channels

| Channel | Status |
|---------|--------|
| Email (IMAP poll) | Ready |
| JotForm (webhook) | Ready |
| Web forms | Ready |
| WhatsApp (Twilio / Meta) | Configure credentials |
| Facebook / Instagram | Requires Meta app review for full production |
| X / TikTok | Admin-configured |

Architecture is in place; rollout is credentials, channel owners, and phased enablement.

---

## Suggested 90-day pilot

| Phase | Focus | Weeks |
|-------|--------|-------|
| **1** | Email + JotForm; core roles; weekly Overview review | 1–4 |
| **2** | WhatsApp; Insights for staffing and themes | 5–8 |
| **3** | Facebook/Instagram (post Meta review); scheduled reports | 9–12 |

**Success metrics (set your baselines in week 1):**

- Time to first response  
- % feedback triaged within SLA  
- Hours spent on manual weekly reporting  
- Negative sentiment volume by theme (trend over 90 days)  

---

## What we need from leadership

1. **Approve pilot** — start with email + JotForm  
2. **Assign channel owners** — Facebook, WhatsApp, email IMAP, JotForm  
3. **Weekly cadence** — 15-minute KPI review using Overview  
4. **Support Meta production** — app review and Page connection for social ingest  

---

## Roles at a glance

| Role | Access |
|------|--------|
| Agent | Assigned queue, reply, resolve |
| Team Lead | Team queue, assign, approve replies |
| Analyst | View all, export, Customer 360 |
| CX Manager | Cross-team view, reports, automation |
| Auditor | Read-only + audit logs |

Staff sign in via **Azure AD**; partners/contractors via approved signup.

---

## More detail

- Full pitch outline: `docs/pitch/cx_leadership_pitch_outline.md`  
- Live demo script: `docs/pitch/demo_script.md`  
- Screenshot guide: `docs/pitch/screenshot_checklist.md`  

**Contact:** [Your name · email · team]

---

*Customer Pulse — One place to see, prioritize, and act on customer feedback.*
