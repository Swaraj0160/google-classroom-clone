import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

/**
 * One-time setup route: visit this URL once, signed into the Google account
 * that owns "Faculty Classroom Storage", to authorize Drive access. Not part
 * of the app's ongoing runtime auth — see app/api/auth/google/callback.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET are not configured." },
      { status: 500 }
    );
  }

  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI || `${request.nextUrl.origin}/api/auth/google/callback`;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive"],
  });

  return NextResponse.redirect(url);
}
