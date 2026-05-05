# Platform Integrations

This platform collects customer feedback from multiple channels and centralizes it in one dashboard.

## Supported Channels

- **Email** (IMAP) - Polls email inbox for new messages
- **WhatsApp** - Twilio or Meta WhatsApp Business API webhooks
- **Instagram** - Meta Graph API webhooks (DMs and comments)
- **Facebook** - Meta Graph API webhooks (Messenger and page comments)

## Setup

### 1. Email Integration (IMAP)

Configure email polling in `.env`:

```bash
EMAIL_IMAP_SERVER=imap.gmail.com
EMAIL_IMAP_PORT=993
EMAIL_USERNAME=your-email@example.com
EMAIL_PASSWORD=your-app-password
```

**Gmail Setup:**
- Enable 2FA
- Generate an "App Password" (not your regular password)
- Use `imap.gmail.com` as server

**Run Email Poller:**

Option A - Cron job (every 15 minutes):
```bash
*/15 * * * * cd /path/to/project && python worker_email_poll.py --once
```

Option B - Continuous worker:
```bash
python worker_email_poll.py --interval 900
```

Or call the endpoint manually:
```bash
curl -X POST http://localhost:5000/integrations/email/poll
```

### 2. WhatsApp Integration

#### Option A: Twilio

1. Sign up for Twilio WhatsApp Sandbox or Business API
2. Configure webhook URL in Twilio console: `https://your-domain.com/integrations/whatsapp/twilio`
3. Add to `.env`:
```bash
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_ACCOUNT_SID=your-account-sid
```

#### Option B: Meta WhatsApp Business API

1. Set up Meta WhatsApp Business API
2. Configure webhook URL: `https://your-domain.com/integrations/whatsapp/meta`
3. Add to `.env`:
```bash
META_APP_SECRET=your-meta-app-secret
META_VERIFY_TOKEN=your-custom-verify-token
```

### 3. Instagram Integration

1. Create Meta App and get Instagram permissions
2. Set up webhook subscription for `instagram` object
3. Configure webhook URL: `https://your-domain.com/integrations/instagram/webhook`
4. Add to `.env`:
```bash
META_APP_SECRET=your-meta-app-secret
META_VERIFY_TOKEN=your-custom-verify-token
META_ACCESS_TOKEN=your-access-token
```

**Webhook Events to Subscribe:**
- `messages` (for DMs)
- `comments` (for post comments)

### 4. Facebook Integration

1. Create Meta App and get Facebook permissions
2. Set up webhook subscription for `page` object
3. Configure webhook URL: `https://your-domain.com/integrations/facebook/webhook`
4. Add to `.env`:
```bash
META_APP_SECRET=your-meta-app-secret
META_VERIFY_TOKEN=your-custom-verify-token
META_ACCESS_TOKEN=your-access-token
```

**Webhook Events to Subscribe:**
- `messages` (for Messenger)
- `feed` (for page post comments)

## Webhook Verification

Meta (Instagram/Facebook/WhatsApp Business) requires webhook verification:

1. When setting up webhook, Meta sends a GET request with:
   - `hub.mode=subscribe`
   - `hub.challenge=<random-string>`
   - `hub.verify_token=<your-token>`

2. Your endpoint verifies the token matches `META_VERIFY_TOKEN` and returns the challenge.

3. If verification succeeds, Meta starts sending webhook events.

## Testing

### Test Email Poll:
```bash
curl -X POST http://localhost:5000/integrations/email/poll \
  -H "Content-Type: application/json" \
  -d '{
    "imap_server": "imap.gmail.com",
    "imap_port": 993,
    "username": "test@example.com",
    "password": "app-password",
    "hours_back": 24
  }'
```

### Test WhatsApp (Twilio):
Send a WhatsApp message to your Twilio number. The webhook will be called automatically.

### Test Instagram/Facebook:
Use Meta's webhook testing tool in the App Dashboard, or send a test message/comment.

## Security Notes

- All webhook endpoints verify signatures when secrets are configured
- Email passwords should be app-specific passwords, not account passwords
- Use HTTPS in production for all webhook endpoints
- Store all secrets in `.env` file (never commit to git)

## Architecture

All integrations normalize incoming messages into the same format and submit to the central `/api/feedback` endpoint (or directly to database). The dashboard then shows all feedback regardless of source, with filtering by `source` field.
