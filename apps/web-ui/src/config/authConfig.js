// ─── Azure AD / MSAL Configuration ───────────────────────────────────────────
// Azure Portal → Azure Active Directory → App registrations → <Your App>
//
//  STEP 1 — Fill in the three values below
//  STEP 2 — In Azure Portal → Authentication, add a Redirect URI:
//           Type: Single-page application (SPA)
//           URI:  http://localhost:5174   (dev)  or  https://<your-domain>  (prod)
//  STEP 3 — In Azure Portal → API permissions, confirm "User.Read" is granted
//  STEP 4 — MFA is enforced via Azure Conditional Access — no code change needed

export const msalConfig = {
  auth: {
    // ── Paste your values here ──────────────────────────────────────────────
    clientId:    import.meta.env.VITE_AZURE_CLIENT_ID,     // Application (client) ID  — Overview tab
    authority:   `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`, // Directory (tenant) ID
    redirectUri: window.location.origin, // Must match the SPA redirect URI in Azure Portal
    // ───────────────────────────────────────────────────────────────────────
  },
  cache: {
    cacheLocation:          'sessionStorage', // Change to 'localStorage' to persist across tabs
    storeAuthStateInCookie: false,            // Set true only if you need IE11 / Safari ITP support
  },
};

// OIDC-only scopes — work without admin consent in any tenant.
// User name + email come from the ID token claims after login.
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

// Optional Graph enrichment (department, jobTitle).
// Only works after an admin grants "User.Read" consent in Azure Portal.
// The app falls back to ID token data automatically if consent is missing.
export const graphRequest = {
  scopes: ['User.Read'],
};

export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
};
