# Customer Pulse — Live Demo Script

**Duration:** 5–7 minutes  
**Audience:** CX and operations managers  
**URL:** https://customerpulse.vercel.app  
**Prerequisite:** Log in as a user with Overview, Inbox, Insights, and Reports access (e.g. `cx_manager`, `analyst`, or `super_admin`)

---

## Before you start

### Pre-demo checklist (2 minutes)

- [ ] Browser logged in; no session timeout during meeting
- [ ] Zoom/display sharing tested; zoom level ~100% for readability
- [ ] Overview already loaded; time filter set to **This Week**
- [ ] Know one real feedback item ID with negative sentiment and a theme (for detail modal)
- [ ] Reports tab accessible (permissions: `reports.export` or admin)
- [ ] Backup: screenshots folder from [screenshot_checklist.md](./screenshot_checklist.md) if Wi‑Fi fails

### Demo narrative arc

```text
Overview (pulse) → Inbox drill-down (action) → Detail (context) → Insights (why) → Export (reporting)
```

---

## Scene 1 — Overview dashboard (90 seconds)

**Navigate to:** `/` (Overview)

### What to show

1. Point to **time filter** — select **This Week** (or **This Month** if This Week is sparse)
2. Point to **KPI cards:**
   - Total Feedback
   - Negative / Positive / Neutral with percentage bars
3. Briefly scan **Sentiment trend** chart and **Volume by channel** donut
4. Scroll to **Recent feedback** list (optional—one glance only)
5. Point to **AI Insight bar** at top or bottom of Overview (if visible)—do not refresh unless you have 10+ seconds spare

### What to say

> “This is the manager’s home screen. Every Monday, you start here: how much feedback came in, how much is negative, and which channels drove volume—all for the period you care about.”

> “These numbers are not static reports. Watch what happens when I click **Negative**…”

### Action

**Click the Negative KPI card.**

**Expected result:** Browser navigates to Inbox with negative sentiment filter applied.

### Transition line

> “That click took us straight to the messages behind the number. No export, no manual filter setup.”

---

## Scene 2 — Inbox triage (90 seconds)

**Navigate to:** `/inbox` (should land here from KPI click, or open manually)

### What to show

1. Confirm **sentiment filter** shows Negative (or All if you opened manually—apply Negative)
2. Point to **tabs:** All · Read · Unread with counts
3. Point to **sidebar cards** (desktop layout):
   - Trending topic
   - High priority
   - Avg peak hours
   - New feedback
4. Open **channel filter** dropdown—show Email, WhatsApp, Facebook, JotForm, etc. in one list
5. Point to **Quick filters:** Unread · High priority · Negative (7d)

### What to say

> “This is where your team works day to day—but as a manager, you care that nothing is stuck. Unread counts, high-priority counts, and trending topics give you a operational snapshot without reading every message.”

> “Every channel feeds the same queue. Your agents are not checking Facebook in one tab and email in another.”

### Action

**Click one high-priority or negative item** to open the detail modal.

### Transition line

> “Let me open one item so you can see what the platform adds beyond the raw message.”

---

## Scene 3 — Feedback detail (60 seconds)

**Location:** Inbox detail modal (overlay)

### What to show

1. **Sentiment label** and **priority score** (and brief priority reason if shown)
2. **Source/channel** (email, facebook, jotform, etc.)
3. **Theme / insurance tags** if present
4. **Policy & product matches** section (if item has policy detection)
5. **View customer** button (if customer key exists)—mention Customer 360 without necessarily navigating away

### What to say

> “On ingest, every message gets sentiment and priority automatically—tuned for insurance language, not generic social listening. Claims delays and billing issues surface faster than routine enquiries.”

> “When a policy number appears in the text, we link it to product context—masked for privacy—so the agent knows which line of business this is about.”

> “If the same customer wrote in on WhatsApp last week and email today, Customer 360 shows that history in one place.”

### Action

**Close modal** (Escape or Close button).

### Transition line

> “Overview tells you *what* happened. Insights tells you *why* and *when*.”

---

## Scene 4 — Insights (90 seconds)

**Navigate to:** `/insights`  
(Or: Overview → “View insights” link / chart drill-down)

### What to show

1. **Insight Brief** banner at top—read one sentence aloud
2. **Theme Landscape** or **Channel Monitors**—pick whichever is clearer in your data
3. **Source × Theme Matrix**—click one cell if time allows (shows investigate flow)
4. **Peak feedback times** heatmap—point to busiest day/hour
5. (Optional) **Top negative issues** bar chart

### What to say

> “Insights is for pattern-spotting: which themes are growing, which channel is noisy, and when customers contact us most.”

> “This heatmap is a staffing conversation. If peak volume is Tuesday 10am, that’s when you want coverage—not spread evenly when nothing is coming in.”

> “The matrix answers questions like: are Facebook complaints mostly about billing or claims? One click takes you to those exact messages.”

### Action (optional, 15 seconds)

Use **Investigate bar**: set theme + channel + negative, click to open Inbox.

### Transition line

> “When you need numbers for a leadership pack or compliance file, you don’t rebuild spreadsheets.”

---

## Scene 5 — Export CSV (60 seconds)

**Navigate to:** `/reports` → **Custom export** tab  
(Alternative: return to Overview and click **Export CSV**)

### What to show

1. Reports filters: sentiment, priority, source, date range
2. Click **Download CSV** (or Overview Export CSV)
3. Open file briefly in Excel/Sheets or show downloaded filename: `feedback_export_*.csv`
4. Point to columns: feedback_id, date_received, channel, sentiment, priority, theme, status, etc.

### What to say

> “One row per feedback—built for analysts. Pivot by channel, theme, or sentiment in Excel or Power BI without reformatting.”

> “Overview export respects whatever time and sentiment filters you had selected—so your weekly negative feedback pack is one click.”

### Action

Close CSV; return to Overview for closing.

---

## Scene 6 — Close and ask (30 seconds)

**Navigate to:** `/` (Overview)

### What to say

> “To recap: Overview for the weekly pulse, Inbox for triage, Insights for diagnosis, Reports for upward reporting—all from the same data, every channel.”

> “What we need from this group today is [pick one or two]:
> - Agreement on a 90-day pilot starting with email and JotForm
> - Named owners for Facebook and WhatsApp credentials
> - A weekly 15-minute KPI review using this Overview screen”

---

## Optional add-ons (if time or questions)

### A — AI Insight refresh (+30 sec)

On Overview, click **Refresh** on AI Insight bar. Say: “This summarizes live data—useful for Monday standup prep or a note to senior leadership.”

### B — Admin Channels (+45 sec)

**Navigate to:** `/admin/channels`

Show integration grid and ingest toggles. Say: “Admins control which channels are live. Architecture is ready; rollout is credentials and governance.”

### C — Notifications (+30 sec)

**Navigate to:** `/notifications`

Show unread badge and one alert linking to feedback. Say: “Agents get in-app alerts for new feedback and spikes—configurable in Settings.”

---

## Troubleshooting during live demo

| Problem | What to do |
|---------|------------|
| Empty Overview / zero KPIs | Switch time filter to **All Time** or **This Month** |
| KPI click does not filter Inbox | Manually open Inbox; set sentiment filter to Negative |
| Insights page sparse | Use Source × Theme or peak times; narrate with “when volume grows, this shows…” |
| Export returns 401 | Logged out—re-auth; or use Overview export while session is valid |
| AI Insight empty or slow | Skip refresh; say rule-based fallback exists |
| Facebook filter shows no items | Expected if Meta still in dev mode—use Email or JotForm for demo |
| Screen too small on projector | Browser zoom 110%; collapse sidebar if needed |

---

## Timing guide

| Scene | Target time | Cumulative |
|-------|-------------|------------|
| 1 Overview | 1:30 | 1:30 |
| 2 Inbox | 1:30 | 3:00 |
| 3 Detail | 1:00 | 4:00 |
| 4 Insights | 1:30 | 5:30 |
| 5 Export | 1:00 | 6:30 |
| 6 Close | 0:30 | 7:00 |

---

## Post-demo follow-up email (template)

**Subject:** Customer Pulse demo — next steps

> Hi all,
>
> Thanks for joining the Customer Pulse walkthrough today.
>
> **Recap:** Unified dashboard (Overview), triage (Inbox), pattern analysis (Insights), and analyst CSV export (Reports).
>
> **Proposed next steps:**
> 1. Phase 1 pilot: email + JotForm — owner: [name] — target start: [date]
> 2. Weekly KPI review: Mondays 9am using Overview — owner: [name]
> 3. Meta production credentials — owner: [name]
>
> **Links:** https://customerpulse.vercel.app  
> **Leave-behind:** [attach manager_summary.md or PDF]
>
> Happy to schedule a 30-minute setup session for channel owners.
>
> [Your name]
