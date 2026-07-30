# Customer Pulse — Estimated Monthly Cost Research

**Prepared for:** Enterprise Life implementation proposal (Section 11)  
**Prepared by:** Nana Araba Amissah Eshun (Business Analyst)  
**Date:** June 2026  
**Currency:** USD (primary); indicative GHS at ~**₵14.50 / USD** — confirm FX at approval time  

This document estimates recurring costs for **Customer Pulse** based on:

- What the platform actually uses ([`vercel.json`](../../vercel.json), [`.env.example`](../../.env.example), channel integrations)
- Published vendor pricing (June 2026)
- Three volume scenarios

**Important:** Customer Pulse is mainly an **ingest + dashboard** system. Most **inbound** customer messages (Facebook comments, Instagram DMs, WhatsApp messages *from customers*) do **not** incur Meta per-message fees. Fees apply mainly when the **business sends** WhatsApp template messages outbound, or when using **paid APIs** (X search, Twilio per-message platform fee, upgraded form plans).

---

## Executive summary (for management)

| Scenario | Monthly estimate (USD) | Indicative GHS | Best for |
|----------|------------------------|----------------|----------|
| **A — Pilot** | **$35 – $85** | ₵500 – ₵1,250 | Email + JotForm + dashboard; limited social |
| **B — Production (recommended)** | **$120 – $250** | ₵1,750 – ₵3,600 | Multi-channel ingest, CX team daily use |
| **C — High volume / full social polling** | **$400 – $900+** | ₵5,800 – ₵13,000+ | Heavy X auto-polling, Twilio WhatsApp, large DB |

**Largest cost levers:**

1. **X (Twitter) automated polling** — can exceed all other costs if left on a short interval (see §6).
2. **JotForm plan** — depends on monthly form submissions (see §5).
3. **Vercel + Neon** — modest at pilot scale; grows with traffic and data retention.
4. **Meta Facebook/Instagram webhooks** — **no per-event API fee**; cost is operational (App Review, staff time), not per comment.

**Recommendation for proposal:** Budget **Scenario B** (~**$150–200/month** / ~**₵2,200–2,900**) for production, plus **one-off** BTS/WEBCS internal effort (not a SaaS line item).

---

## 1. What Customer Pulse runs on

| Layer | Service | Role |
|-------|---------|------|
| Hosting | **Vercel** | Frontend + Flask API (`customerpulse.vercel.app`) |
| Database | **Neon Postgres** | Feedback, users, analytics |
| AI summaries | **Google Gemini** | Overview “AI Insight” ([`feedback_analyzer.py`](../../backend/app/services/feedback_analyzer.py)) |
| Email ingest | **IMAP** (e.g. Gmail / corporate mailbox) | Scheduled poll `/api/integrations/email/poll` |
| Forms | **JotForm** | Webhook ingest |
| Social / messaging | **Meta**, **Twilio**, **X**, **TikTok** | Webhooks or polling per channel |

Sentiment analysis uses **VADER/NLTK on the server** — no external API charge.

---

## 2. Vercel (application hosting)

**Source:** [Vercel Pro plan](https://vercel.com/docs/plans/pro-plan) — **$20 USD per deploying team seat / month**, includes **$20 usage credit**.

Customer Pulse deploys **two services** (frontend + Python API) on one project. For a single maintainer with viewer access for management, expect:

| Item | Cost |
|------|------|
| Pro platform (1 deploying seat) | **$20 / month** |
| Included credit | **$20** toward metered usage |
| Typical pilot overage | **$0 – $15** (low traffic internal app) |
| **Subtotal** | **$20 – $35 / month** |

**Notes:**

- **Hobby (free)** is not suitable for commercial production; cron and limits are restrictive ([README](../../README.md)).
- Extra developer seats are **$20 each** if multiple people deploy.
- Viewer seats (read-only dashboard access in Vercel) are **free**.

**Scenario estimates:**

| Scenario | Vercel USD/month |
|----------|------------------|
| A Pilot | $20 – $25 |
| B Production | $20 – $40 |
| C High volume | $40 – $120 (bandwidth / function overage) |

---

## 3. Neon Postgres (database)

**Source:** [Neon pricing](https://neon.com/pricing) — **Launch** plan, pay-per-use, **no monthly minimum** (as of late 2025).

| Metric | Launch rate |
|--------|-------------|
| Compute | **$0.106 / CU-hour** (scales to zero when idle) |
| Storage | **$0.35 / GB-month** |
| Instant restore (optional) | **$0.20 / GB-month** |

**CU** ≈ 1 vCPU + 4 GB RAM. Customer Pulse is not heavy OLTP; ingest bursts then idle.

### Rough sizing

| Scenario | Feedback / month | Est. storage | Compute pattern | Est. USD/month |
|----------|------------------|--------------|-----------------|----------------|
| A Pilot | 500 – 2,000 | 1 – 3 GB | Scale-to-zero, ~50–150 CU-hrs | **$5 – $20** |
| B Production | 5,000 – 20,000 | 5 – 15 GB | ~200–400 CU-hrs | **$25 – $55** |
| C High volume | 50,000+ | 30 – 80 GB | Always-on or high CU | **$80 – $200+** |

**Example (Pilot):** 100 CU-hours × $0.106 = **$10.60** + 2 GB × $0.35 = **$0.70** → **~$11/month**.

**Example (Production):** 300 CU-hours × $0.106 = **$31.80** + 10 GB × $0.35 = **$3.50** → **~$35/month**.

---

## 4. Google Gemini (AI Overview summaries)

**Source:** [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) — **Gemini 2.5 Flash** (recommended in README: `gemini-2.5-flash`):

| | Rate |
|---|------|
| Input | **$0.30 / 1M tokens** |
| Output | **$2.50 / 1M tokens** |
| Free tier | Available for development (limits apply) |

The analyzer sends aggregated metrics + up to **20 message excerpts** (320 chars each) per run — not full corpus ([`feedback_analyzer.py`](../../backend/app/services/feedback_analyzer.py)).

**Estimated tokens per refresh:** ~6,000–12,000 input, ~800–1,500 output.

| Usage pattern | Refreshes / month | Est. USD/month |
|---------------|-------------------|----------------|
| Light (5 managers, few manual refreshes) | 50 – 150 | **$0 – $2** (often within free tier) |
| Moderate (daily standup use) | 300 – 600 | **$3 – $10** |
| Heavy (frequent auto-refresh) | 2,000+ | **$15 – $40** |

**Scenario estimates:** **$0 – $10** (A/B), **$10 – $40** (C).

Fallback rule-based summaries cost **$0** if API key is unset.

---

## 5. JotForm (web forms)

**Source:** [Jotform pricing](https://www.jotform.com/pricing/) — webhooks included on **all plans** (no per-webhook fee).

| Plan | Effective monthly (annual billing) | Monthly submissions |
|------|-----------------------------------|-------------------|
| Starter | **$0** | 100 |
| Bronze | **~$34** | 1,000 |
| Silver | **~$39** | 2,500 |
| Gold | **~$99** | 10,000 |
| Enterprise | Custom | Unlimited |

**Choose plan by submission volume**, not by Customer Pulse itself.

| Scenario | Assumption | JotForm USD/month |
|----------|------------|-------------------|
| A Pilot | &lt; 100 submissions | **$0** |
| B Production | 500 – 2,000 submissions | **$34 – $39** |
| C High volume | 5,000+ submissions | **$99+** or Enterprise quote |

For insurance customer feedback, **Gold** may be needed if **HIPAA/BAA** is required (~**$99/month**).

---

## 6. Email ingest (IMAP)

| Option | Cost |
|--------|------|
| Existing Enterprise Life shared mailbox | **$0** incremental (recommended) |
| Dedicated Google Workspace user | **~$6 – $14 / user / month** |
| Microsoft 365 mailbox | Typically covered by existing M365 licence |

Polling runs via Vercel Cron or external worker — no separate email SaaS fee.

---

## 7. Meta — Facebook, Instagram, WhatsApp (webhooks)

**Sources:** [Meta Graph webhooks](https://developers.facebook.com/docs/graph-api/webhooks/), [WhatsApp pricing](https://developers.facebook.com/docs/whatsapp/pricing/)

### Receiving feedback (Customer Pulse use case)

| Channel | API / webhook fee to receive messages? |
|---------|----------------------------------------|
| Facebook Page (Messenger, comments via `feed`) | **No per-event charge** |
| Instagram (DMs, comments) | **No per-event charge** |
| WhatsApp — **customer messages to business** | **Service messages: free** |
| Meta developer app | **$0** |

**What you still need (non-monetary / one-off):**

- Meta **App Review** and **Live** mode for all public customers
- Business verification (time, documentation)
- HTTPS webhook on Vercel (already in place)

### WhatsApp — when charges apply

Meta charges for **template messages the business sends outbound**, by category and country.

**Ghana (recipient) indicative rates** (Meta rate card, April 2026 — verify before budget sign-off):

| Category | USD per delivered template |
|----------|---------------------------|
| Marketing | **~$0.0225** |
| Utility | **~$0.0040** |
| Authentication | **~$0.0040** |
| **Customer-initiated service (inbound to inbox)** | **Free** |

Customer Pulse **ingest only** → budget **$0** Meta messaging unless you add **outbound** WhatsApp replies from the platform later.

### Twilio path (alternative WhatsApp)

If using **Twilio** instead of Meta Cloud API directly:

| Fee | Rate |
|-----|------|
| Twilio platform fee | **$0.005 per message** (inbound or outbound) |
| Meta template pass-through | As above (outbound templates only) |

**Example:** 2,000 inbound WhatsApp messages/month via Twilio → 2,000 × $0.005 = **$10/month** Twilio fee alone (Meta still free for service inbound).

| Scenario | Meta webhook USD | Twilio (if used) |
|----------|------------------|------------------|
| A Pilot | **$0** | **$0 – $10** |
| B Production | **$0** | **$10 – $50** |
| C High volume | **$0** | **$50 – $200** |

---

## 8. X (Twitter) — highest risk line item

**Source:** X API pay-per-use (2026) — approx **$0.005 per post read**; new accounts use credits, no fixed $200 Basic tier.

Customer Pulse polls **recent search** ([`x_integration.py`](../../backend/app/integrations/x_integration.py)):

- Default max results: **25 tweets per poll** (`X_POLL_MAX_RESULTS`)
- Default interval: **900 seconds (15 min)** in config, or **300 seconds** in `.env.example`

### Cost formula

```text
Monthly post reads = (minutes in month / poll interval minutes) × max_results per poll
Monthly cost USD   = post reads × $0.005
```

| Polling mode | Polls / month | Reads (@ 25/poll) | **USD / month** |
|--------------|---------------|-------------------|-----------------|
| **Manual only** (Admin → Channels) | ~30 | 750 | **~$4** |
| **Once daily** | 30 | 750 | **~$4** |
| **Every 6 hours** | 120 | 3,000 | **~$15** |
| **Every 15 minutes** | 2,880 | 72,000 | **~$360** |
| **Every 5 minutes** | 8,640 | 216,000 | **~$1,080** |

**Strong recommendation:** Do **not** enable aggressive auto-polling on X for production until query volume is approved. Use **manual poll** or **daily** schedule unless budget explicitly allows **$300+/month** for X alone.

| Scenario | Assumed X mode | X USD/month |
|----------|----------------|-------------|
| A Pilot | Manual / off | **$0 – $10** |
| B Production | Daily or manual | **$5 – $20** |
| C High volume | 15-min auto-poll | **$300 – $1,000+** |

---

## 9. TikTok

**Source:** [TikTok for Developers](https://developers.tiktok.com/) — official API access has **no published per-call fee**.

| Approach | Cost |
|----------|------|
| Official TikTok app (Display / Business API) after app review | **$0** API fee |
| Third-party scraping APIs (if official access insufficient) | **~$29 – $189 / month** |

Budget **$0** for official path; reserve **$50 – $150/month** only if a commercial data provider is required.

---

## 10. Microsoft Entra ID (enterprise login)

**Source:** Microsoft Entra ID pricing — **Free** tier covers SSO for business apps for most organisations already on Microsoft 365.

| Item | Cost |
|------|------|
| SSO for staff (`enterprise-auth-setup.md`) | **$0** incremental if M365/Entra already licensed |
| Entra ID P1 (only if IT requires conditional access features) | **~$6 – $12 / user / month** |

Assume **$0** unless IT specifies otherwise.

---

## 11. “Social media subscriptions” (Phase 3 budget line)

Your implementation plan includes **payments and subscriptions to various social media for data ingestion**. Map to likely line items:

| Item | Typical cost | Required for Customer Pulse? |
|------|--------------|----------------------------|
| Meta developer / Page connection | **$0** | Yes |
| X API credits | **Pay-as-you-go** (see §8) | If X ingest enabled |
| JotForm upgrade | **$34 – $99 / month** | If submission limits exceeded |
| TikTok official API | **$0** | If approved |
| Third-party social listening tools | **$50 – $500+ / month** | Only if bought instead of native ingest |
| WhatsApp Business verification | **$0** (Meta) | Recommended |
| Twilio account | Usage-based | Optional WhatsApp path |

**Suggested Phase 3 budget bucket:** **$50 – $150/month** for X credits + form upgrades + contingency, **excluding** Twilio message volume.

---

## 12. BTS, WEBCS, NIC, GIA (internal)

These are **Enterprise Life internal integrations**, not third-party SaaS:

| Workstream | Vendor charge | Cost type |
|------------|---------------|-----------|
| BTS integration & engagement | None from external vendor | **Internal staff / project time** |
| WEBCS connection | None | **Internal** |
| NIC / GIA engagement | None | **Internal** |

Do not list these as recurring USD subscriptions unless BTS procures a specific licence (e.g. SIP, middleware). Note as **“Internal — BTS to confirm”** in the proposal.

---

## 13. Consolidated monthly estimates

### Scenario A — Pilot (Months 1–2)

*Email + JotForm + dashboard; Meta in dev/test; X off or manual*

| Component | USD/month |
|-----------|-----------|
| Vercel Pro | $20 – $25 |
| Neon | $5 – $15 |
| Gemini | $0 – $2 |
| JotForm | $0 – $34 |
| Email | $0 |
| Meta (FB/IG/WA ingest) | $0 |
| WhatsApp (Twilio, light) | $0 – $10 |
| X | $0 – $10 |
| TikTok | $0 |
| **Total** | **$35 – $85** |
| **Indicative GHS** | **₵500 – ₵1,250** |

---

### Scenario B — Production (recommended budget)

*Multi-channel live; daily X poll; Bronze/Silver JotForm; moderate feedback volume*

| Component | USD/month |
|-----------|-----------|
| Vercel Pro | $20 – $35 |
| Neon | $25 – $55 |
| Gemini | $3 – $10 |
| JotForm | $34 – $99 |
| Email | $0 |
| Meta ingest | $0 |
| WhatsApp (Twilio, moderate inbound) | $10 – $40 |
| X (daily / manual) | $5 – $20 |
| TikTok | $0 |
| Social subscription contingency | $30 – $50 |
| **Total** | **$120 – $250** |
| **Indicative GHS** | **₵1,750 – ₵3,600** |

---

### Scenario C — High volume / full automation

*Heavy feedback, Twilio WhatsApp, 15-min X polling, Gold JotForm*

| Component | USD/month |
|-----------|-----------|
| Vercel Pro + overage | $40 – $120 |
| Neon | $80 – $200 |
| Gemini | $15 – $40 |
| JotForm Gold / Enterprise | $99 – $300+ |
| Meta ingest | $0 |
| WhatsApp Twilio (10k+ msgs) | $50 – $200 |
| X (15-min auto-poll) | **$300 – $1,000** |
| TikTok third-party (if used) | $29 – $189 |
| **Total** | **$600 – $2,000+** |
| **Indicative GHS** | **₵8,700 – ₵29,000+** |

---

## 14. One-off / annual costs (not monthly)

| Item | Estimate | Notes |
|------|----------|-------|
| Meta App Review | **$0** | Staff time only |
| Domain / SSL | **$0** | Included on Vercel |
| Voice recording (N/A for Customer Pulse) | — | EL Calls item, not this platform |
| Training (CX + management) | **Internal** | Per proposal §7 |
| Security / penetration test | **Internal or quoted** | If QA requires |

---

## 15. Section 11 table for proposal (copy-paste)

Use this in the **Customer Pulse Platform Proposal**:

| Component | Monthly cost (USD) | Monthly cost (indicative GHS) | Notes |
|-----------|-------------------|-------------------------------|-------|
| Vercel Pro (hosting) | $20 – $35 | ₵290 – ₵510 | 1 deploy seat; includes $20 usage credit |
| Neon Postgres (database) | $25 – $55 | ₵360 – ₵800 | Pay-per-use; scales with feedback volume |
| Google Gemini (AI summaries) | $3 – $10 | ₵45 – ₵145 | Light management use; optional |
| JotForm | $34 – $99 | ₵490 – ₵1,440 | Depends on monthly form submissions |
| Email (IMAP) | $0 | ₵0 | Use existing corporate mailbox |
| Meta — Facebook, Instagram, WhatsApp **ingest** | $0 | ₵0 | Webhooks free; App Review required |
| WhatsApp via Twilio (if used) | $10 – $40 | ₵145 – ₵580 | $0.005/msg platform fee on Twilio path |
| X (Twitter) ingest | $5 – $20 | ₵75 – ₵290 | **Daily/manual poll only**; auto 15-min poll ~$360+ |
| TikTok ingest | $0 – $50 | ₵0 – ₵725 | Official API free; third-party if needed |
| Social platform subscriptions (contingency) | $30 – $50 | ₵435 – ₵725 | X credits, form upgrades, approvals |
| BTS / WEBCS / NIC / GIA | Internal | Internal | No external SaaS fee |
| **Estimated total (production)** | **$120 – $250** | **₵1,750 – ₵3,600** | Scenario B — recommended budget |

**Footnote for signatories:** *Figures based on June 2026 vendor pricing and Customer Pulse architecture. X polling frequency is the largest variable; 15-minute auto-polling is not recommended without explicit budget approval. Final JotForm tier depends on submission volume. GHS equivalents use ₵14.50/USD.*

---

## 16. Cost control recommendations

1. **Cap X polling** — manual or daily until social team confirms query and budget.
2. **Start JotForm on Starter/Bronze** — upgrade when submission counts require it.
3. **Use Meta Cloud API direct** for WhatsApp ingest where possible — avoid Twilio per-message fee on high inbound volume.
4. **Neon scale-to-zero** — keep enabled for non-business hours.
5. **Gemini** — manual “Refresh” on Overview for managers; avoid unattended high-frequency auto-refresh.
6. **Review Neon storage annually** — archive or purge old feedback per retention policy to limit GB-month charges.

---

## 17. Sources

| Vendor | URL |
|--------|-----|
| Vercel Pro | https://vercel.com/docs/plans/pro-plan |
| Neon | https://neon.com/pricing |
| Google Gemini API | https://ai.google.dev/gemini-api/docs/pricing |
| Jotform | https://www.jotform.com/pricing/ |
| Meta WhatsApp pricing | https://developers.facebook.com/docs/whatsapp/pricing/ |
| Meta Webhooks | https://developers.facebook.com/docs/graph-api/webhooks/ |
| Twilio WhatsApp | https://www.twilio.com/en-us/whatsapp/pricing |
| X API (pay-per-use) | https://developer.x.com/en/docs/twitter-api |

---

*This research supports Section 11 of the Customer Pulse implementation proposal. Update quarterly or when vendors change pricing.*
