# Setting Up Email Integration - Step by Step

## The Error You're Seeing

```
{"error": "Missing email configuration"}
```

This means your `.env` file doesn't have the email credentials configured.

## Quick Fix

### Option 1: Use Gmail (Recommended for Testing)

**Step 1: Get Gmail App Password**

1. Go to https://myaccount.google.com
2. Click **Security** in the left sidebar
3. Under "Signing in to Google", click **2-Step Verification**
   - If not enabled, enable it first (Google will guide you)
4. Go back to **Security** page
5. Under "Signing in to Google", click **App passwords**
6. Select:
   - **App**: Mail
   - **Device**: Other (Custom name)
   - **Name**: "Feedback Platform"
7. Click **Generate**
8. Copy the 16-character password (looks like: `abcd efgh ijkl mnop`)

**Step 2: Update .env File**

Open `.env` and update these lines:

```bash
EMAIL_IMAP_SERVER=imap.gmail.com
EMAIL_IMAP_PORT=993
EMAIL_USERNAME=your-actual-email@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop  # Remove spaces from app password
```

**Important:** 
- Use your **full Gmail address** for `EMAIL_USERNAME`
- Use the **16-character app password** (no spaces) for `EMAIL_PASSWORD`
- **NOT your regular Gmail password!**

**Step 3: Test It**

```bash
# Make sure Flask is running
python run_dev.py

# In another terminal:
curl -X POST http://localhost:5000/integrations/email/poll
```

**Expected Response:**
```json
{
  "message": "Processed 0 emails",
  "emails_found": 0,
  "processed": 0
}
```

If you see this (even with 0 emails), it means the connection worked!

### Option 2: Use Other Email Providers

**Outlook/Office365:**
```bash
EMAIL_IMAP_SERVER=outlook.office365.com
EMAIL_IMAP_PORT=993
EMAIL_USERNAME=your-email@outlook.com
EMAIL_PASSWORD=your-app-password
```

**Yahoo:**
```bash
EMAIL_IMAP_SERVER=imap.mail.yahoo.com
EMAIL_IMAP_PORT=993
EMAIL_USERNAME=your-email@yahoo.com
EMAIL_PASSWORD=your-app-password
```

**Custom IMAP Server:**
```bash
EMAIL_IMAP_SERVER=mail.yourdomain.com
EMAIL_IMAP_PORT=993
EMAIL_USERNAME=your-email@yourdomain.com
EMAIL_PASSWORD=your-password
```

## Troubleshooting

### "IMAP login failed"

**Possible causes:**
1. Wrong password - Make sure you're using App Password, not regular password
2. 2FA not enabled - Gmail requires 2FA for app passwords
3. Wrong username - Use full email address
4. Spaces in password - Remove all spaces from app password

**Fix:**
- Double-check the app password (no spaces)
- Regenerate app password if needed
- Verify 2FA is enabled

### "Connection timeout"

**Possible causes:**
1. Firewall blocking port 993
2. Wrong IMAP server address
3. Network issues

**Fix:**
- Check firewall settings
- Verify IMAP server address is correct
- Try from different network

### "No emails found" (but connection works)

**This is normal if:**
- Your inbox is empty
- All emails are older than 24 hours (default lookback period)

**To check older emails:**
```bash
curl -X POST http://localhost:5000/integrations/email/poll \
  -H "Content-Type: application/json" \
  -d '{"hours_back": 168}'  # Check last 7 days
```

### Still Not Working?

1. **Check Flask logs** - Look for detailed error messages
2. **Test IMAP connection manually:**
   ```python
   import imaplib
   mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
   mail.login("your-email@gmail.com", "your-app-password")
   mail.select("INBOX")
   print("Success!")
   ```
3. **Verify credentials** - Make sure .env file is in project root
4. **Restart Flask** - Changes to .env require restart

## Next Steps

Once email polling works:

1. **Set up automatic polling:**
   ```bash
   python worker_email_poll.py --interval 900  # Every 15 minutes
   ```

2. **Or use cron job:**
   ```bash
   crontab -e
   # Add: */15 * * * * cd /path/to/project && python worker_email_poll.py --once
   ```

3. **Check your dashboard** - New emails will appear as feedback entries!

## Security Notes

- **Never commit .env to git** - It contains passwords
- **Use App Passwords** - More secure than regular passwords
- **Rotate passwords** - Change app passwords periodically
- **Limit access** - Only give app passwords to trusted applications
