# Public HTTPS URL (no sudo): Cloudflare “quick tunnel”

If you **don’t have sudo** but need Meta to reach your local backend, use Cloudflare’s quick tunnel.

## Prereqs
- Your Flask backend must be running locally on `http://127.0.0.1:5000`
- You must have `curl` available

## Run (recommended)
From the project root:

```bash
bash scripts/cloudflared_quick_tunnel.sh
```

It will print a public URL like:

- `https://something.trycloudflare.com`

## Use in Meta
Use that base URL to configure webhooks:

- Instagram callback URL:
  - `https://something.trycloudflare.com/integrations/instagram/webhook`
- Facebook callback URL:
  - `https://something.trycloudflare.com/integrations/facebook/webhook`

## If your backend uses a different port
Pass the port number:

```bash
bash scripts/cloudflared_quick_tunnel.sh 5000
```

