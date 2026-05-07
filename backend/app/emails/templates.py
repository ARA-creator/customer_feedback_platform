from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from ..core.config import get_config


def _brand_logo_svg() -> str:
    # Inline SVG so we don't depend on external assets in email clients.
    return """
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Customer Pulse">
        <rect x="1" y="1" width="38" height="38" rx="12" fill="#EAF7F0" stroke="rgba(0,151,80,0.22)"/>
        <path d="M12.5 22.5c3.2-8.6 7.0 6.0 11.2-3.4 1.3-2.9 2.6-4.2 4.8-1.6" stroke="#009750" stroke-width="2.6" stroke-linecap="round"/>
        <circle cx="27.2" cy="17.5" r="2.2" fill="#009750"/>
      </svg>
    """


def _base_html(*, title: str, preheader: str, body_html: str) -> str:
    cfg = get_config()
    year = datetime.now(tz=timezone.utc).year
    support = cfg.SUPPORT_EMAIL
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>{title}</title>
    <style>
      :root {{
        color-scheme: light;
        supported-color-schemes: light;
      }}
      body {{
        margin: 0;
        padding: 0;
        background: #f0f4f1;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Arial, sans-serif;
        color: #111827;
      }}
      .container {{
        width: 100%;
        padding: 28px 14px;
      }}
      .card {{
        max-width: 620px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid rgba(17,24,39,0.08);
        border-radius: 18px;
        box-shadow: 0 18px 48px rgba(2,6,23,0.08);
        overflow: hidden;
      }}
      .header {{
        padding: 22px 22px 14px 22px;
        background:
          radial-gradient(700px 260px at 20% 0%, rgba(0,151,80,0.14), transparent 60%),
          radial-gradient(500px 220px at 85% 10%, rgba(16,185,129,0.12), transparent 60%),
          linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(249,251,249,1) 100%);
      }}
      .brand {{
        display: flex;
        align-items: center;
        gap: 12px;
      }}
      .brand-title {{
        font-size: 14px;
        font-weight: 700;
        letter-spacing: -0.01em;
        margin: 0;
      }}
      .brand-sub {{
        font-size: 12px;
        margin: 2px 0 0 0;
        color: rgba(17,24,39,0.62);
      }}
      .content {{
        padding: 18px 22px 22px 22px;
      }}
      h1 {{
        font-size: 20px;
        margin: 0 0 10px 0;
        letter-spacing: -0.02em;
      }}
      p {{
        margin: 0 0 12px 0;
        line-height: 1.55;
        color: rgba(17,24,39,0.78);
        font-size: 14px;
      }}
      .cta {{
        display: inline-block;
        background: #009750;
        color: #fff !important;
        text-decoration: none;
        font-weight: 700;
        font-size: 14px;
        padding: 12px 14px;
        border-radius: 12px;
      }}
      .muted {{
        color: rgba(17,24,39,0.58);
        font-size: 12px;
      }}
      .footer {{
        padding: 14px 22px 22px 22px;
        border-top: 1px solid rgba(17,24,39,0.06);
      }}
      .preheader {{
        display:none !important;
        visibility:hidden;
        opacity:0;
        color:transparent;
        height:0;
        width:0;
        overflow:hidden;
        mso-hide:all;
      }}
      @media (max-width: 480px) {{
        .header, .content, .footer {{ padding-left: 16px; padding-right: 16px; }}
        h1 {{ font-size: 18px; }}
      }}
    </style>
  </head>
  <body>
    <div class="preheader">{preheader}</div>
    <div class="container">
      <div class="card">
        <div class="header">
          <div class="brand">
            {_brand_logo_svg()}
            <div>
              <p class="brand-title">Customer Pulse</p>
              <p class="brand-sub">Enterprise Life · Feedback Platform</p>
            </div>
          </div>
        </div>
        <div class="content">
          {body_html}
        </div>
        <div class="footer">
          <p class="muted">
            Need help? Contact <a href="mailto:{support}" style="color:#009750;text-decoration:none;font-weight:700">{support}</a>.
          </p>
          <p class="muted" style="margin-top:8px;">© {year} Customer Pulse</p>
        </div>
      </div>
    </div>
  </body>
</html>"""


@dataclass
class EmailTemplate:
    subject: str
    html: str
    text: str


def welcome_email(*, name: str, email: str) -> EmailTemplate:
    who = (name or "").strip() or email
    body = f"""
      <h1>Welcome, {who}.</h1>
      <p>Your account has been created successfully. You can now sign in and start monitoring feedback across channels.</p>
      <p class="muted">If you didn’t create this account, please reply to this email.</p>
    """
    return EmailTemplate(
        subject="Welcome to Customer Pulse",
        html=_base_html(title="Welcome to Customer Pulse", preheader="Your account is ready.", body_html=body),
        text=f"Welcome, {who}. Your account has been created.",
    )


def verify_email(*, name: str, code: str) -> EmailTemplate:
    who = (name or "").strip() or "there"
    body = f"""
      <h1>Verify your email</h1>
      <p>Hi {who}, use this verification code to finish setting up your Customer Pulse account:</p>
      <div style="margin: 16px 0 10px 0; padding: 14px 14px; border-radius: 14px; border: 1px solid rgba(17,24,39,0.10); background: rgba(0,151,80,0.06);">
        <div style="font-size: 24px; font-weight: 800; letter-spacing: 0.28em; color: #0b3b1f; text-align: center;">
          {code}
        </div>
      </div>
      <p class="muted">This code expires in 24 hours.</p>
    """
    return EmailTemplate(
        subject="Verify your email for Customer Pulse",
        html=_base_html(title="Verify your email", preheader="Confirm your email address.", body_html=body),
        text=f"Your verification code is: {code}",
    )


def reset_password_email(*, name: str, code: str) -> EmailTemplate:
    who = (name or "").strip() or "there"
    body = f"""
      <h1>Reset your password</h1>
      <p>Hi {who}, we received a request to reset your password.</p>
      <p>Use this reset code to continue:</p>
      <div style="margin: 16px 0 10px 0; padding: 14px 14px; border-radius: 14px; border: 1px solid rgba(17,24,39,0.10); background: rgba(0,151,80,0.06);">
        <div style="font-size: 24px; font-weight: 800; letter-spacing: 0.28em; color: #0b3b1f; text-align: center;">
          {code}
        </div>
      </div>
      <p class="muted">If you didn’t request this, you can ignore this email. This code expires in 30 minutes.</p>
    """
    return EmailTemplate(
        subject="Reset your Customer Pulse password",
        html=_base_html(title="Reset your password", preheader="Reset link inside.", body_html=body),
        text=f"Your password reset code is: {code}",
    )

