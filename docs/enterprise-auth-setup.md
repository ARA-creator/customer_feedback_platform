# Enterprise SSO and dual-path signup

Customer Pulse supports two ways to access the platform:

1. **Enterprise email** — Microsoft Entra ID (Azure AD) single sign-on. No password form; roles come from Azure AD groups.
2. **No enterprise email** — Manual signup for partners/contractors. An administrator must **approve** the account before login works.

## IT prerequisites (Enterprise SSO)

1. Register an app in **Microsoft Entra ID** (Azure Portal → App registrations).
2. Set redirect URI to match your API:
   - Local dev: `http://127.0.0.1:5000/auth/enterprise/callback`
   - Production: `https://<your-api-host>/auth/enterprise/callback` (Vercel strips `/api` prefix in routing; use the URL Flask receives after rewrite).
3. Create a client secret and note **Tenant ID**, **Application (client) ID**.
4. API permissions (delegated): `openid`, `profile`, `email`, `User.Read`, `GroupMember.Read.All`.
5. Grant admin consent for the organization.
6. Map Azure AD **security group display names** to Customer Pulse roles via `AZURE_AD_ROLE_MAPPING` (JSON).

## Configuration

### Admin UI (recommended)

Users with `admin.manage_integrations` can open **Admin → Enterprise SSO** and configure:

- Tenant ID, Client ID, redirect URI, client secret (encrypted in `app_settings`)
- Enterprise email domains
- Default role and Azure AD group → role mappings

Settings saved in the database **override** the environment variables below. Leave the client secret field empty when saving to keep the existing secret.

Use **Test connection** to verify Microsoft login metadata (and optionally validate the client secret).

### Environment variables (fallback / bootstrap)

```env
ENTERPRISE_EMAIL_DOMAINS=enterprisegroup.net.gh,enterprise-life.com
EXTERNAL_SIGNUP_ENABLED=true

AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_REDIRECT_URI=http://127.0.0.1:5000/auth/enterprise/callback
AZURE_AD_DEFAULT_ROLE=agent
AZURE_AD_ROLE_MAPPING={"Customer Pulse Admins":"super_admin","CX Managers":"cx_manager"}
```

Until Azure is configured (via admin UI or env), the **“I have an Enterprise email”** button shows a configuration message; external signup still works.

## Admin workflow (external users)

1. User chooses **I do not have an Enterprise email** → submits name, email, password.
2. Admin opens **Users → Pending** → **Approve** (pick role) or **Reject**.
3. Approved users sign in with email + password.

## One-time DB backfill (optional)

Mark existing users as verified if migrating from an older auth flow:

```sql
UPDATE users
SET email_verified_at = COALESCE(email_verified_at, NOW()),
    approved_at = COALESCE(approved_at, NOW())
WHERE deleted_at IS NULL;
```

Or run: `python scripts/dev/mark_all_users_verified.py`
