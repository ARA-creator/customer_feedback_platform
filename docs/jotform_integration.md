# JotForm integration

Customer Pulse ingests JotForm submissions via a native webhook endpoint.

## 1) Configure backend secret

Set on the backend (`.env` locally or Vercel → Environment Variables):

- `JOTFORM_WEBHOOK_SECRET`: a long random string

JotForm cannot send custom HTTP headers, so pass the secret in the webhook URL:

```
https://YOUR_DOMAIN/api/integrations/jotform/webhook?secret=YOUR_JOTFORM_WEBHOOK_SECRET
```

For manual testing you may also send header `X-Webhook-Secret`.

## 2) Webhook endpoint

- `POST /integrations/jotform/webhook`
- Production (Vercel): `https://customerpulse.vercel.app/api/integrations/jotform/webhook?secret=YOUR_SECRET`

Open in browser for setup hints:

- `GET /integrations/jotform/webhook`

## 3) Connect JotForm

1. Open your form in JotForm
2. **Settings → Integrations → Webhooks**
3. Add webhook URL (with `?secret=` as above)
4. Click **Complete Integration**
5. Submit a test entry

JotForm sends `multipart/form-data` with a `rawRequest` field (JSON). The backend parses feedback, email, rating, and category fields automatically when your question names include common labels like **Feedback**, **Email**, **Rating**, or **Category**.

## 4) Customer Pulse admin

1. **Admin → Channels**
2. Ensure **JotForm** ingest is **On**
3. After the first submission, status changes from **JotForm (ready)** to **JotForm**

## 5) Dedupe

Submissions dedupe by `(form_id, submission_id)` from JotForm's `formID` and `submissionID` fields.

## 6) Field mapping tips

Name your JotForm questions clearly:

| Question label (examples) | Maps to |
|---|---|
| Feedback, Message, Comments | Main inbox message |
| Email, Email address | Customer email |
| Rating, Score, NPS | 1–10 rating |
| Category, Topic, Department | Category tag |

If no dedicated feedback field exists, the backend uses JotForm's `pretty` summary or concatenates all answers.
