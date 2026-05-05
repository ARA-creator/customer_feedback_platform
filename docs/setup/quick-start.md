# Quick Start Guide - Multi-Channel Feedback Platform

## 🚀 Get Started in 5 Minutes

### Step 1: Start Your Flask App

```bash
cd /home/araba/customer_feedback_platform
source .venv/bin/activate
python run_dev.py
```

Your app is now running at `http://localhost:5000`

### Step 2: Test the Integrations

**Open a new terminal** and run:

```bash
python test_integrations.py
```

This simulates webhooks from WhatsApp, Instagram, and Facebook. You'll see:
- Test results in terminal
- New feedback entries in your dashboard

### Step 3: View Results

Open your browser: `http://localhost:5000`

You should see:
- Dashboard with feedback from different sources
- Sentiment analysis (positive/negative/neutral)
- Priority queue
- Charts showing distribution

---

## 📧 Setting Up Real Integrations

### Email (Easiest to Start)

1. **Get Gmail App Password:**
   - https://myaccount.google.com → Security → App passwords
   - Generate password for "Mail"

2. **Add to `.env`:**
   ```bash
   EMAIL_IMAP_SERVER=imap.gmail.com
   EMAIL_USERNAME=your-email@gmail.com
   EMAIL_PASSWORD=your-16-char-app-password
   ```

3. **Test it:**
   ```bash
   curl -X POST http://localhost:5000/integrations/email/poll
   ```

4. **Set up automatic polling:**
   ```bash
   # Run every 15 minutes
   python worker_email_poll.py --interval 900
   ```

### WhatsApp (Twilio - Free Trial)

1. **Sign up:** https://www.twilio.com/try-twilio
2. **Enable WhatsApp Sandbox** in Twilio Console
3. **Set webhook URL:** `https://your-domain.com/integrations/whatsapp/twilio`
   - For local testing, use ngrok: `ngrok http 5000`
4. **Add to `.env`:**
   ```bash
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_ACCOUNT_SID=your_sid
   ```

### Instagram/Facebook (Meta)

1. **Create app:** https://developers.facebook.com/apps/
2. **Add Instagram/Messenger products**
3. **Set webhook:** `https://your-domain.com/integrations/instagram/webhook`
4. **Add to `.env`:**
   ```bash
   META_APP_SECRET=your_secret
   META_VERIFY_TOKEN=your_verify_token
   ```

---

## 🎓 Learning Path

1. **Read:** `TUTORIAL_INTEGRATIONS.md` - Complete step-by-step guide
2. **Practice:** Run `test_integrations.py` to see how webhooks work
3. **Experiment:** Modify the code to add your own features
4. **Deploy:** Set up real webhooks with providers

---

## 📚 Key Files to Understand

- `app/routes/integrations.py` - Webhook endpoints
- `app/integrations/email_integration.py` - Email polling logic
- `app/integrations/whatsapp_integration.py` - WhatsApp parsing
- `app/integrations/meta_integration.py` - Instagram/Facebook parsing
- `worker_email_poll.py` - Background email worker

---

## 💡 Tips

- **Start with email** - easiest to test locally
- **Use ngrok** for local webhook testing
- **Check Flask logs** to see what's happening
- **Test one channel at a time** - don't try to set up everything at once

---

## 🆘 Need Help?

1. Check `TUTORIAL_INTEGRATIONS.md` for detailed explanations
2. Check Flask logs for error messages
3. Test with `test_integrations.py` first before setting up real webhooks
4. Verify `.env` file has correct credentials

Happy learning! 🎉
