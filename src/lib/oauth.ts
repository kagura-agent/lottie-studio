import crypto from "node:crypto";

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  callbackPath: string;
}

export const GITHUB_CONFIG: OAuthConfig = {
  clientId: process.env.GITHUB_CLIENT_ID || "",
  clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  authorizeUrl: "https://github.com/login/oauth/authorize",
  tokenUrl: "https://github.com/login/oauth/access_token",
  scope: "read:user user:email",
  callbackPath: "/api/auth/github/callback",
};

export const GOOGLE_CONFIG: OAuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scope: "openid email profile",
  callbackPath: "/api/auth/google/callback",
};

export function generateState(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function buildAuthorizeUrl(
  config: OAuthConfig,
  state: string,
  callbackUrl: string
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: callbackUrl,
    scope: config.scope,
    state,
    response_type: "code",
  });
  return `${config.authorizeUrl}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  config: OAuthConfig,
  code: string,
  callbackUrl: string
): Promise<string> {
  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: callbackUrl,
    }).toString(),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`OAuth error: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

export interface OAuthProfile {
  providerAccountId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export async function fetchGitHubProfile(
  accessToken: string
): Promise<OAuthProfile> {
  const [userRes, emailsRes] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    }),
    fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    }),
  ]);

  if (!userRes.ok) throw new Error("Failed to fetch GitHub user");
  const user = await userRes.json();

  let email = user.email;
  if (!email && emailsRes.ok) {
    const emails = await emailsRes.json();
    const primary = emails.find(
      (e: { primary: boolean; verified: boolean; email: string }) =>
        e.primary && e.verified
    );
    email = primary?.email || emails[0]?.email;
  }

  if (!email) throw new Error("No email found on GitHub account");

  return {
    providerAccountId: String(user.id),
    email,
    displayName: user.name || user.login || null,
    avatarUrl: user.avatar_url || null,
  };
}

export async function fetchGoogleProfile(
  accessToken: string
): Promise<OAuthProfile> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error("Failed to fetch Google user");
  const user = await res.json();

  if (!user.email) throw new Error("No email found on Google account");

  return {
    providerAccountId: user.id,
    email: user.email,
    displayName: user.name || null,
    avatarUrl: user.picture || null,
  };
}

const STATE_COOKIE_MAX_AGE = 600; // 10 minutes

export function buildStateCookie(state: string, isProduction: boolean): string {
  return `oauth-state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${STATE_COOKIE_MAX_AGE}${isProduction ? "; Secure" : ""}`;
}

export function clearStateCookie(isProduction: boolean): string {
  return `oauth-state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${isProduction ? "; Secure" : ""}`;
}

export function parseStateCookie(cookieHeader: string): string | null {
  const match = cookieHeader.match(/(?:^|;\s*)oauth-state=([^\s;]+)/);
  return match ? match[1] : null;
}

export function getCallbackUrl(request: Request, callbackPath: string): string {
  const url = new URL(request.url);
  return `${url.origin}${callbackPath}`;
}
