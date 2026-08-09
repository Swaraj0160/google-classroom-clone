import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

function htmlResponse(body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><body style="font-family:sans-serif;max-width:640px;margin:40px auto;line-height:1.5">${body}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) {
    return htmlResponse(`<h2>Authorization not completed</h2><p>${oauthError}</p>`, 400);
  }
  if (!code) {
    return htmlResponse("<h2>Missing authorization code.</h2>", 400);
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return htmlResponse(
      "<h2>GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are not configured.</h2>",
      500
    );
  }

  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI || `${request.nextUrl.origin}/api/auth/google/callback`;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return htmlResponse(
        `<h2>No refresh token returned</h2>
         <p>Google only issues a refresh token the first time an app is authorized. Remove this app's
         access at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>,
         then reload this authorization flow so Google issues a fresh one.</p>`,
        400
      );
    }

    // Server renders the token once, directly to the person completing this
    // one-time setup step. It is never sent to any client-side app code,
    // never logged, and never written to a file by this server.
    return htmlResponse(`
      <h2>Google Drive authorized</h2>
      <p>Copy this value into the <code>GOOGLE_OAUTH_REFRESH_TOKEN</code> environment variable
      (locally in <code>.env.local</code> and in Vercel → Project Settings → Environment Variables),
      then restart the dev server / redeploy. This page will not show the token again.</p>
      <textarea readonly style="width:100%;height:90px;font-family:monospace;padding:8px">${tokens.refresh_token}</textarea>
      <p>You can close this tab once it's saved.</p>
    `);
  } catch (err) {
    console.error("[api/auth/google/callback]", err instanceof Error ? err.message : err);
    return htmlResponse("<h2>Failed to exchange the authorization code.</h2>", 500);
  }
}
