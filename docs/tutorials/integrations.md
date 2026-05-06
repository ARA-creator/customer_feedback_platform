# Tutorial: Building Multi-Channel Feedback Collection

## Table of Contents
1. [Understanding the Architecture](#understanding-the-architecture)
2. [Email Integration - Step by Step](#email-integration)
3. [WhatsApp Integration - Step by Step](#whatsapp-integration)
4. [Instagram Integration - Step by Step](#instagram-integration)
5. [Facebook Integration - Step by Step](#facebook-integration)
6. [Testing Your Integrations](#testing)
7. [Troubleshooting Common Issues](#troubleshooting)

---

## Understanding the Architecture

### The Big Picture

Think of your platform as a **central post office** that receives mail from different mailboxes:

```
Customer sends feedback → External Platform → Your Integration → Your Database → Dashboard
```

**Example Flow:**
1. Customer sends WhatsApp message to your business number
2. Twilio (WhatsApp provider) receives it
3. Twilio sends a webhook (HTTP POST) to your server
4. Your `/integrations/whatsapp/twilio` endpoint receives it
5. Your code parses the message and saves it to database
6. Dashboard shows it with `source="whatsapp"`

### Key Concepts

**Webhooks vs Polling:**
- **Webhooks** (WhatsApp, Instagram, Facebook): Platform pushes data to you when something happens
- **Polling** (Email): You check for new messages periodically

**Why This Design?**
- All channels feed into ONE database table (`feedback`)
- Same sentiment analysis for all sources
- One dashboard shows everything
- Easy to add new channels later

---

## Email Integration

### How Email Works (IMAP)

**IMAP** = Internet Message Access Protocol. It's how email clients (like Gmail app) read emails from a server.

**Your Code Flow:**
```
worker_email_poll.py → Calls /integrations/email/poll → fetch_emails() → 
Parses emails → process_email_to_feedback() → Saves to database
```

### Step 1: Get Gmail App Password

**Why?** Gmail blocks regular passwords for security. You need a special "App Password".

**Steps:**
1. Go to https://myaccount.google.com
2. Click "Security" → "2-Step Verification" (enable if not already)
3. Go back to Security → "App passwords"
4. Select "Mail" and "Other (Custom name)"
5. Name it "Feedback Platform"
6. Copy the 16-character password (looks like: `abcd efgh ijkl mnop`)

**Important:** Remove spaces when using it → `abcdefghijklmnop`

### Step 2: Configure Your .env File

Open your `.env` file and add:

```bash
# Email Configuration
EMAIL_IMAP_SERVER=imap.gmail.com
EMAIL_IMAP_PORT=993
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop  # The app password from Step 1
```

**Explanation:**
- `EMAIL_IMAP_SERVER`: Gmail's IMAP server address
- `EMAIL_IMAP_PORT`: 993 = secure SSL connection
- `EMAIL_USERNAME`: Your full Gmail address
- `EMAIL_PASSWORD`: The app password (not your regular password!)

### Step 3: Test Email Connection

**Manual Test:**
```bash
# Start your Flask app first
python run_dev.py

# In another terminal, test the endpoint
curl -X POST http://localhost:5000/integrations/email/poll \
  -H "Content-Type: application/json"
```

**What Happens:**
1. Code connects to `imap.gmail.com:993`
2. Logs in with your credentials
3. Searches for emails in INBOX from last 24 hours
4. Parses each email (subject + body)
5. Saves each as feedback with `source="email"`

**Expected Response:**
```json
{
  "message": "Processed 3 emails",
  "emails_found": 3,
  "processed": 3
}
```

### Step 4: Set Up Automatic Polling

**Option A: Cron Job (Recommended for Production)**

Cron runs commands on a schedule. Edit your crontab:
```bash
crontab -e
```

Add this line (runs every 15 minutes):
```
*/15 * * * * cd /home/araba/customer_feedback_platform && /home/araba/customer_feedback_platform/.venv/bin/python worker_email_poll.py --once
```

**Breaking down the cron syntax:**
- `*/15` = every 15 minutes
- `* * * *` = every hour, every day, every month, every day of week
- Full path to Python ensures it uses your virtual environment

**Option B: Continuous Worker (Good for Testing)**

```bash
python worker_email_poll.py --interval 900
```

This runs forever, checking every 15 minutes (900 seconds).

### How the Email Parser Works

**Code Walkthrough:**

```python
# 1. Connect to email server
mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
mail.login("your-email@gmail.com", "app-password")

# 2. Select inbox folder
mail.select("INBOX")

# 3. Search for emails (last 24 hours)
status, messages = mail.search(None, '(SINCE "11-Feb-2026")')

# 4. For each email ID found
for email_id in email_ids:
    # 5. Fetch the raw email
    status, msg_data = mail.fetch(email_id, "(RFC822)")
    
    # 6. Parse it
    email_message = email.message_from_bytes(msg_data[0][1])
    
    # 7. Extract text
    subject = email_message["Subject"]
    body = extract_body(email_message)  # Gets plain text or HTML
    
    # 8. Convert to feedback format
    feedback_payload = {
        "message": f"{subject}\n\n{body}",
        "source": "email",
        "email": sender_email,
        ...
    }
    
    # 9. Save to database
    _submit_to_feedback_api(feedback_payload)
```

**Key Functions:**
- `decode_header()`: Handles special characters in email headers
- `msg.walk()`: Iterates through email parts (text, HTML, attachments)
- `get_payload(decode=True)`: Gets the actual text content

---

## WhatsApp Integration

### Understanding WhatsApp Business APIs

**Two Options:**

1. **Twilio WhatsApp** (Easier to start)
   - Twilio acts as middleman
   - You get a Twilio WhatsApp number
   - Customers message that number
   - Twilio forwards to your webhook

2. **Meta WhatsApp Business API** (More control)
   - Direct from Meta/Facebook
   - Requires business verification
   - More features, more setup

### Option 1: Twilio WhatsApp (Recommended for Learning)

#### Step 1: Sign Up for Twilio

1. Go to https://www.twilio.com/try-twilio
2. Create free account (get $15 credit)
3. Verify your phone number

#### Step 2: Enable WhatsApp Sandbox

1. In Twilio Console → Messaging → Try it out → Send a WhatsApp message
2. Follow instructions to join sandbox (send code to Twilio number)
3. Note your Twilio number (looks like: `whatsapp:+14155238886`)

#### Step 3: Configure Webhook

1. In Twilio Console → Phone Numbers → Manage → Active numbers
2. Click your WhatsApp number
3. Under "Messaging" → "A MESSAGE COMES IN"
4. Enter: `https://your-domain.com/integrations/whatsapp/twilio`
5. Save

**For Local Testing (ngrok):**
```bash
# Install ngrok: https://ngrok.com/download
ngrok http 5000

# Use the ngrok URL in Twilio webhook:
# https://abc123.ngrok.io/integrations/whatsapp/twilio
```

#### Step 4: Add Twilio Credentials to .env

```bash
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_ACCOUNT_SID=your_account_sid_here
```

Find these in: Twilio Console → Account → API Credentials

#### Step 5: Test It

Send a WhatsApp message to your Twilio sandbox number. You should see:

**In your Flask logs:**
```
INFO: Received WhatsApp message from +1234567890
INFO: Saved feedback with source=whatsapp
```

**In your dashboard:**
- New feedback entry
- `source` = "whatsapp"
- `channel_metadata` contains masked phone number

### How Twilio Webhook Works

**What Twilio Sends:**
```
POST /integrations/whatsapp/twilio
Content-Type: application/x-www-form-urlencoded

Body=I+need+help+with+my+claim&From=whatsapp%3A%2B1234567890&To=whatsapp%3A%2B14155238886&MessageSid=SM123...
```

**Your Code:**
```python
@integrations_bp.route("/whatsapp/twilio", methods=["POST"])
def whatsapp_twilio_webhook():
    # 1. Get form data (Twilio sends as form, not JSON)
    form_data = request.form.to_dict()
    
    # 2. Verify signature (security check)
    if twilio_auth_token:
        if not verify_twilio_signature(...):
            return "Invalid", 403
    
    # 3. Parse the message
    feedback_payload = parse_twilio_webhook(form_data)
    # Returns: {
    #   "message": "I need help with my claim",
    #   "source": "whatsapp",
    #   "channel_metadata": {"from_number_masked": "****7890", ...}
    # }
    
    # 4. Save to database
    _submit_to_feedback_api(feedback_payload)
    
    # 5. Return success (Twilio expects 200 OK)
    return jsonify({"status": "ok"}), 200
```

**Signature Verification:**
Twilio signs every request with HMAC-SHA1. Your code verifies it matches to prevent fake requests.

---

## Instagram Integration

### Understanding Meta Graph API

Instagram is owned by Meta (Facebook). They use the **Graph API** for integrations.

**Key Concepts:**
- **App**: Your application registered with Meta
- **Webhook**: Meta sends HTTP POST when events happen
- **Verify Token**: Secret string you set (Meta uses it to verify you)
- **App Secret**: Another secret for signing webhooks

### Step 1: Create Meta App

1. Go to https://developers.facebook.com/apps/
2. Click "Create App"
3. Choose "Business" type
4. Name it (e.g., "Customer Feedback Platform")
5. Note your **App ID** and **App Secret**

### Step 2: Add Instagram Product

1. In your app dashboard → "Add Product"
2. Find "Instagram" → "Set Up"
3. This enables Instagram API access

### Step 3: Configure Webhook

1. In app dashboard → Instagram → Webhooks
2. Click "Add Callback URL"
3. Enter: `https://your-domain.com/integrations/instagram/webhook`
4. **Verify Token**: Enter a random string (e.g., `my-secret-verify-token-123`)
5. Click "Verify and Save"

**What Happens:**
- Meta sends GET request: `?hub.mode=subscribe&hub.challenge=abc123&hub.verify_token=my-secret...`
- Your code checks if verify_token matches
- If yes, return the challenge string
- Meta marks webhook as verified

### Step 4: Subscribe to Events

1. In Webhooks section → "Manage Subscriptions"
2. Subscribe to:
   - `messages` (for Instagram DMs)
   - `comments` (for post comments)
3. Click "Subscribe"

### Step 5: Add Credentials to .env

```bash
META_APP_SECRET=your_app_secret_here
META_VERIFY_TOKEN=my-secret-verify-token-123
META_ACCESS_TOKEN=your_access_token_here  # Optional, for sending replies
```

### Step 6: Test Webhook

**Using Meta's Test Tool:**
1. In Webhooks → "Test" button
2. Select event type
3. Meta sends test webhook to your URL

**Or send a real DM:**
- Have someone send you an Instagram DM
- Check your Flask logs for the webhook

### How Instagram Webhook Works

**What Meta Sends:**
```json
{
  "entry": [{
    "messaging": [{
      "sender": {"id": "123456"},
      "recipient": {"id": "789012"},
      "message": {
        "text": "I love your service!",
        "mid": "message_id_123"
      },
      "timestamp": 1234567890
    }]
  }]
}
```

**Your Code:**
```python
@integrations_bp.route("/instagram/webhook", methods=["GET", "POST"])
def instagram_webhook():
    # GET = webhook verification
    if request.method == "GET":
        verify_token = request.args.get("hub.verify_token")
        if verify_token == META_VERIFY_TOKEN:
            return request.args.get("hub.challenge"), 200
        return "Invalid", 403
    
    # POST = actual webhook event
    # 1. Verify signature
    signature = request.headers.get("X-Hub-Signature-256")
    if not verify_meta_webhook_signature(payload, signature, app_secret):
        return "Invalid", 403
    
    # 2. Parse payload
    payload = request.get_json()
    feedback_payload = parse_instagram_webhook(payload)
    
    # 3. Save to database
    _submit_to_feedback_api(feedback_payload)
    
    return jsonify({"status": "ok"}), 200
```

**Signature Verification:**
Meta signs with HMAC-SHA256. Header format: `sha256=<hash>`

---

## Facebook Integration

### Step 1: Add Facebook Product

1. In your Meta app dashboard → "Add Product"
2. Find "Messenger" → "Set Up"
3. This enables Facebook Messenger API

### Step 2: Configure Webhook

1. Messenger → Webhooks → "Add Callback URL"
2. URL: `https://your-domain.com/integrations/facebook/webhook`
3. Verify Token: Same as Instagram (or different, your choice)
4. Subscribe to: `messages`, `messaging_postbacks`

### Step 3: For Page Comments

1. Add "Page" product
2. Webhooks → Subscribe to `feed` events
3. This captures comments on your page posts

### Step 4: Test

Send a Facebook message to your page, or comment on a post.

**The code is identical to Instagram** - both use Meta Graph API, just different endpoints.

---

## Testing

### Test Email Integration

```bash
# 1. Start Flask app
python run_dev.py

# 2. In another terminal, trigger email poll
curl -X POST http://localhost:5000/integrations/email/poll

# 3. Check response
# Should see: {"message": "Processed X emails", ...}

# 4. Check dashboard
# Open http://localhost:5000
# Look for new feedback with source="email"
```

### Test WhatsApp (Twilio)

```bash
# 1. Make sure Flask is running
# 2. Use ngrok for local testing:
ngrok http 5000

# 3. Update Twilio webhook URL to ngrok URL
# 4. Send WhatsApp message to your Twilio number
# 5. Check Flask logs - should see webhook received
# 6. Check dashboard - new feedback should appear
```

### Test Instagram/Facebook

```bash
# 1. Use ngrok for local webhook
ngrok http 5000

# 2. Update Meta webhook URL to ngrok URL
# 3. Use Meta's test tool or send real message
# 4. Check logs and dashboard
```

### Debugging Tips

**Check Flask Logs:**
```bash
# Look for:
# - Webhook received messages
# - Error tracebacks
# - Database save confirmations
```

**Test Webhook Manually:**
```bash
# Simulate Twilio webhook:
curl -X POST http://localhost:5000/integrations/whatsapp/twilio \
  -d "Body=Test+message&From=whatsapp%3A%2B1234567890&To=whatsapp%3A%2B14155238886"
```

**Check Database:**
```bash
# If using Postgres (recommended for deployments, e.g. Neon):
# Requires `DATABASE_URL` to be set in your shell or `.env`.
psql "$DATABASE_URL" -c "SELECT id, source, message_encrypted, created_at FROM feedback ORDER BY id DESC LIMIT 5;"
```

---

## Troubleshooting

### Email Issues

**"IMAP login failed"**
- Check app password is correct (no spaces)
- Make sure 2FA is enabled on Gmail
- Try generating new app password

**"No emails found"**
- Check `hours_back` parameter (default 24)
- Make sure emails exist in INBOX folder
- Check email server logs

**"Connection timeout"**
- Check firewall allows port 993
- Verify IMAP server address is correct

### WhatsApp Issues

**"Webhook not receiving messages"**
- Verify webhook URL in Twilio console
- Check ngrok is running (for local testing)
- Make sure Flask app is running
- Check Twilio logs in console

**"Invalid signature"**
- Verify `TWILIO_AUTH_TOKEN` in .env matches Twilio console
- Check webhook URL matches exactly (no trailing slash)

### Instagram/Facebook Issues

**"Webhook verification failed"**
- Check `META_VERIFY_TOKEN` matches what you entered in Meta dashboard
- Make sure endpoint returns challenge string (not JSON)

**"Invalid signature"**
- Verify `META_APP_SECRET` is correct
- Check webhook is receiving raw request body (not parsed JSON)

**"No events received"**
- Make sure you subscribed to correct events
- Check page/app has necessary permissions
- Verify webhook is in "Subscribed" status

### General Issues

**"Feedback not appearing in dashboard"**
- Check database: `SELECT * FROM feedback WHERE source='whatsapp' ORDER BY id DESC;`
- Verify sentiment analysis ran (check `sentiment_label` column)
- Check Flask logs for errors during save

**"Webhook works but data is wrong"**
- Check `channel_metadata` column - contains raw webhook data
- Add logging: `logger.info(f"Received payload: {payload}")`
- Compare with provider's webhook documentation

---

## Next Steps

1. **Add Error Handling**: Wrap webhook handlers in try/except
2. **Add Rate Limiting**: Prevent spam/abuse
3. **Add Reply Functionality**: Send responses back to customers
4. **Add Filtering**: Only process certain types of messages
5. **Add Deduplication**: Prevent processing same message twice

---

## Key Takeaways

1. **Webhooks = Push**: Platform sends data to you when events happen
2. **Polling = Pull**: You check for new data periodically
3. **All channels normalize to same format**: Makes dashboard simple
4. **Security matters**: Always verify webhook signatures
5. **Test locally first**: Use ngrok before deploying to production
6. **Log everything**: Makes debugging much easier

---

## Practice Exercises

1. **Modify email parser** to extract customer ID from email subject if it matches pattern "POL12345"
2. **Add filtering** to ignore auto-replies (emails with "Auto:" in subject)
3. **Add reply functionality** for WhatsApp (use Twilio API to send message back)
4. **Create test script** that simulates all webhook types
5. **Add webhook status page** showing last received webhook from each channel

Good luck! 🚀
