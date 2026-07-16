# Activate Google Sign-In

Vital Passport includes a **Continue with Google** button through Supabase Auth. The button remains harmless until the Google provider is configured in the Supabase project.

## 1. Open the Supabase Google provider

In the Vital Passport Supabase project, open:

**Authentication → Sign In / Providers → Google**

Keep this page open. It shows the Supabase callback URL required by Google.

## 2. Configure Google Auth Platform

In Google Cloud, create or select a project and open **Google Auth Platform**.

Configure:

- **Branding:** Vital Passport name, support email, and production domain
- **Audience:** External for general users, or Internal only when restricted to a Google Workspace organization
- **Data Access:** only `openid`, email, and profile scopes

Do not request Gmail, Drive, Calendar, or other Google-data permissions for authentication.

## 3. Create the OAuth client

Under **Clients**, create an OAuth client with application type **Web application**.

Authorized JavaScript origins:

```text
https://vitalpassport.com
```

Add the local Vite origin only when local Google login is needed:

```text
http://localhost:5173
```

Authorized redirect URI:

```text
Copy the exact callback URL shown on the Supabase Google provider page.
```

It usually has this shape:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

Do not substitute `https://vitalpassport.com` for the Google redirect URI. Google returns to Supabase first, and Supabase then returns the user to Vital Passport.

## 4. Enable Google in Supabase

Copy the Google Client ID and Client Secret into the Supabase Google provider page, enable the provider, and save.

The Client Secret stays in Supabase. It must not be added to Vercel or exposed through a `VITE_` environment variable.

## 5. Confirm Vital Passport redirect URLs

In **Authentication → URL Configuration**, confirm:

```text
Site URL: https://vitalpassport.com
Redirect URL: https://vitalpassport.com/**
```

## 6. Test

1. Sign out of Vital Passport.
2. Open the sidebar account panel.
3. Choose **Continue with Google**.
4. Complete the Google consent screen.
5. Confirm Vital Passport returns to `https://vitalpassport.com` and shows **Cloud saved**.
6. Confirm the same account row is used when the Google email matches an existing magic-link account.

## Trust boundary

Google is used only to establish identity. Vital Passport does not request access to Gmail, Drive, Calendar, contacts, or other Google services.
