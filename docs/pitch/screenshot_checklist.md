# Customer Pulse — Screenshot Checklist for Pitch Deck

Capture these from **https://customerpulse.vercel.app** (or local dev if production data is sensitive). Save into `docs/pitch/screenshots/` using the filenames below.

**Tips:**

- Use **1920×1080** or **1440×900** browser window for consistent aspect ratio
- Hide personal bookmarks bar; use incognito if extensions clutter the UI
- Log in as a user with full dashboard access (`cx_manager`, `analyst`, or `super_admin`)
- Prefer **light theme** unless your deck is dark-themed (Settings → Display)
- Crop screenshots to remove unrelated desktop clutter before inserting into slides

---

## Required screenshots (6)

### 1. `01-overview-this-week.png`

**Used on:** Slide 5 — Overview dashboard

**URL:** `/`

**Steps:**

1. Log in
2. Set time filter to **This Week** (or **This Month** if sparse)
3. Ensure KPI cards visible: Total, Negative, Positive, Neutral
4. Include at least two charts: Sentiment trend + Volume by channel
5. Include AI Insight bar if visible without scrolling
6. Capture full viewport above the fold; optional second shot scrolled to Recent feedback

**Verify before saving:**

- [ ] KPI numbers are non-zero (or use All Time if demo data is thin)
- [ ] Enterprise Life / Customer Pulse branding visible in sidebar
- [ ] No sensitive customer PII in recent feedback preview (blur if needed)

---

### 2. `02-insights-matrix-or-peak-times.png`

**Used on:** Slide 6 — Insights

**URL:** `/insights`

**Steps:**

1. Navigate to Insights (sidebar not required—type URL or use Overview “View insights”)
2. Set range to **Last 30d** or **Last 7d** (whichever shows richer data)
3. **Preferred shot A:** Source × Theme Matrix with visible cell values
4. **Preferred shot B:** Peak feedback times heatmap with color variation
5. Capture Insight Brief banner at top if it fits

**Optional second file:** `02b-insights-theme-landscape.png` for appendix

**Verify:**

- [ ] At least one chart shows meaningful color/data variation
- [ ] Investigate bar visible if possible

---

### 3. `03-inbox-sidebar-filters.png`

**Used on:** Slide 7 — Unified Inbox

**URL:** `/inbox`

**Steps:**

1. Open Inbox on **desktop-width** window (sidebar cards hidden on mobile)
2. Ensure sidebar shows four cards: Trending topic, High priority, Avg peak hours, New feedback
3. Open **channel filter** dropdown showing Email, WhatsApp, Facebook, JotForm, etc.
4. Show tabs: All · Read · Unread with counts
5. List should show 5+ items

**Verify:**

- [ ] Sidebar summary cards visible
- [ ] Channel dropdown open in same capture OR take `03b-inbox-channel-dropdown.png` separately

---

### 4. `04-inbox-detail-policy-customer360.png`

**Used on:** Slide 7 (detail) and demo script Scene 3

**URL:** `/inbox` → open one feedback item

**Steps:**

1. Pick an item with **negative sentiment** and visible **theme tags**
2. Prefer item with **policy/product matches** if available
3. Open detail modal
4. Capture: sentiment, priority, source, theme tags, policy section, “View customer” button

**Verify:**

- [ ] Mask any unmasked policy numbers or personal emails if presenting externally
- [ ] Modal fully visible (not cut off)

---

### 5. `05-reports-custom-export.png`

**Used on:** Slide 10 — Reports and exports

**URL:** `/reports` → **Custom export** tab

**Steps:**

1. Navigate to Reports (requires export permission)
2. Select Custom export tab
3. Show filter row: Sentiment, Priority, Source, Category, Date from/to, Limit
4. Include **Download CSV** button prominently

**Optional:** `05b-csv-preview.png` — open exported CSV in Excel showing column headers (first 5 rows only, redact text)

**Verify:**

- [ ] Custom export tab active (not Schedules)
- [ ] User has access (page not “permission denied”)

---

### 6. `06-admin-channels-grid.png`

**Used on:** Slide 12 — Channels connected

**URL:** `/admin/channels`

**Steps:**

1. Log in as admin or user with `admin.manage_integrations`
2. Capture full channel grid: WhatsApp, Instagram, Facebook, JotForm, Email, Web, X, TikTok
3. Show connection/ingest status indicators and toggles if visible

**Verify:**

- [ ] At least 6 channels visible
- [ ] No secrets/API keys visible on screen

---

## Optional screenshots (3)

### 7. `07-overview-ai-insight-bar.png`

**Used on:** Slide 9 — AI assistant

**URL:** `/`

**Steps:** Overview with AI Insight bar expanded or visible; optionally mid-refresh with summary text showing

---

### 8. `08-settings-how-it-works.png`

**Used on:** Slide 4 — How it works (alternative visual)

**URL:** `/settings/help`

**Steps:** Capture the four “How it works” cards if rendered on Help page

---

### 9. `09-admin-users-roles.png`

**Used on:** Slide 11 — Team roles (optional visual)

**URL:** `/admin/users` or `/admin/roles`

**Steps:** Show role column or permissions checkboxes (no passwords, no personal emails—blur if needed)

---

## Slide-to-screenshot map

| Slide | Topic | Primary screenshot |
|-------|--------|-------------------|
| 5 | Overview | `01-overview-this-week.png` |
| 6 | Insights | `02-insights-matrix-or-peak-times.png` |
| 7 | Inbox | `03-inbox-sidebar-filters.png` |
| 7 | Inbox detail | `04-inbox-detail-policy-customer360.png` |
| 9 | AI | `07-overview-ai-insight-bar.png` (optional) |
| 10 | Reports | `05-reports-custom-export.png` |
| 12 | Channels | `06-admin-channels-grid.png` |

---

## Problem slide visual (Slide 2) — create in slides tool

No app screenshot needed. Build a simple diagram:

**Left column — disconnected channels (icons):**

Email · WhatsApp · Facebook · JotForm · Instagram · X

**Right column — manager questions:**

- What’s trending?
- Who owns this?
- Is it getting worse?

Use gray/disconnected styling on left; red question marks on right. Optional arrow on Slide 3 showing all channels flowing into Customer Pulse logo.

---

## Architecture appendix (Slide A2) — create in slides tool

Simple horizontal flow (icons optional):

```text
Customer → Channel (Email / Meta / JotForm) → Customer Pulse API → Database → Dashboard
```

---

## File organization

```text
docs/pitch/
├── cx_leadership_pitch_outline.md
├── demo_script.md
├── manager_summary.md
├── screenshot_checklist.md   (this file)
└── screenshots/
    ├── 01-overview-this-week.png
    ├── 02-insights-matrix-or-peak-times.png
    ├── 03-inbox-sidebar-filters.png
    ├── 04-inbox-detail-policy-customer360.png
    ├── 05-reports-custom-export.png
    └── 06-admin-channels-grid.png
```

Create the `screenshots/` folder when capturing; images are not committed if they contain production PII—use sanitized exports for shared decks.

---

## Privacy checklist before sharing deck

- [ ] Blur or redact customer names, emails, phone numbers in inbox/detail shots
- [ ] Blur policy numbers if not masked in UI
- [ ] Remove internal admin emails from Users screenshot
- [ ] Confirm Meta/webhook secrets not visible on Channels screen
