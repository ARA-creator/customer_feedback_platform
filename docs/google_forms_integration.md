# Google Forms integration (no-login on server)

This platform can ingest Google Forms submissions via a **Google Apps Script** webhook.

## 1) Configure backend secret
Set an environment variable on the backend:

- `GOOGLE_FORMS_WEBHOOK_SECRET`: a long random string

This will be validated against the request header:
- `X-Webhook-Secret: <your secret>`

## 2) Webhook endpoint
Your backend receives submissions at:

- `POST /integrations/google/forms`

Open in browser for a schema hint:
- `GET /integrations/google/forms`

## 3) Create an Apps Script for your Form
1. Open your Google Form
2. Click the **three dots** menu → **Script editor** (or open Apps Script and bind it to the form)
3. Paste the script below
4. Set:
   - `WEBHOOK_URL` to your public tunnel/backend URL + `/integrations/google/forms`
   - `WEBHOOK_SECRET` to the same value as `GOOGLE_FORMS_WEBHOOK_SECRET`

## 4) Apps Script (example)

```javascript
const WEBHOOK_URL = 'https://YOUR_TUNNEL.trycloudflare.com/integrations/google/forms';
const WEBHOOK_SECRET = 'YOUR_GOOGLE_FORMS_WEBHOOK_SECRET';

function onFormSubmit(e) {
  // Adjust these to match your form questions.
  // e.response.getItemResponses() gives you all answers.
  const form = FormApp.getActiveForm();
  const response = e.response;

  const answers = {};
  const itemResponses = response.getItemResponses();
  itemResponses.forEach((ir) => {
    const q = ir.getItem().getTitle();
    const a = ir.getResponse();
    answers[q] = a;
  });

  // Try to map common fields if they exist
  const message = answers['Feedback'] || answers['Message'] || JSON.stringify(answers);
  const email = answers['Email'] || answers['Email address'] || '';
  const ratingRaw = answers['Rating'] || '';
  const rating = parseInt(ratingRaw, 10);

  const payload = {
    form_id: form.getId(),
    response_id: response.getId(),
    timestamp: new Date().toISOString(),
    email: email,
    message: message,
    rating: Number.isFinite(rating) ? rating : null,
    answers: answers,
  };

  UrlFetchApp.fetch(WEBHOOK_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      'X-Webhook-Secret': WEBHOOK_SECRET,
    },
    muteHttpExceptions: true,
  });
}
```

## 5) Add the trigger
In Apps Script:
- Triggers → Add trigger
- Choose function: `onFormSubmit`
- Event source: **From form**
- Event type: **On form submit**

## 6) Dedupe
The backend dedupes by:
- `(form_id, response_id)` when available

So replays won’t duplicate feedback.

