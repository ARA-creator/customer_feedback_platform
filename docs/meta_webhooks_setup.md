# Meta (Facebook + Instagram) webhooks setup

This project can ingest **Facebook** and **Instagram** messages/comments into the Inbox via:

- `POST /integrations/facebook/webhook`
- `POST /integrations/instagram/webhook`

Both endpoints support **Meta’s GET verification challenge** and (optionally) **request signature verification**.

## 1) Create a Meta app
- Go to the Meta developer console and create an app.
- Add the **Webhooks** product.

## 2) Configure environment variables
Set these on the backend (in `.env` or your deployment env):

- `META_VERIFY_TOKEN`: a secret string you choose (used for the initial GET verify challenge).
- `META_APP_SECRET`: your Meta app secret (used to verify `X-Hub-Signature-256`).
- `META_ACCESS_TOKEN` (optional): not required for basic ingestion, but useful for follow-up Graph API fetches later.

## 3) Expose a public HTTPS callback URL
For local development, expose the Flask backend using **Cloudflare Tunnel** or **ngrok**, then use the public base URL for webhook callbacks.

Your callback URLs must be:
- `https://<public>/integrations/facebook/webhook`
- `https://<public>/integrations/instagram/webhook`

## 4) Subscribe to webhook events
In the Webhooks product settings, subscribe to the objects/fields you want. A reasonable starting point:

- **Facebook Page**: messages, feed (for comments/posts if enabled)
- **Instagram**: messages, comments (depending on your account/product setup)

Note: which fields are available depends on account type and app permissions.

## 5) Verify the webhook
Meta will call your endpoint with a GET verification request:

- `hub.mode=subscribe`
- `hub.verify_token=<your META_VERIFY_TOKEN>`
- `hub.challenge=<random string>`

If the token matches, the backend echoes the `hub.challenge`.

## 6) Validate signatures (recommended)
If `META_APP_SECRET` is set, the backend validates:
- `X-Hub-Signature-256: sha256=<hex>`

Requests failing validation are rejected with **403**.

## 7) What gets stored
Incoming payloads are normalized into the existing Feedback ingestion format:

- `source`: `facebook` or `instagram`
- `message`: message/comment text
- `channel_metadata`: includes ids (entry id, sender/recipient ids, comment ids, etc.) and event type

