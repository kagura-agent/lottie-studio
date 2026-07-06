import {
  GOOGLE_CONFIG,
  exchangeCodeForToken,
  fetchGoogleProfile,
  clearStateCookie,
  parseStateCookie,
  getCallbackUrl,
} from "@/lib/oauth";
import {
  findOrCreateOAuthUser,
  createSession,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const isProduction = process.env.NODE_ENV === "production";

  if (error) {
    return Response.redirect(new URL("/?auth_error=access_denied", url.origin));
  }

  if (!code || !state) {
    return Response.redirect(new URL("/?auth_error=missing_params", url.origin));
  }

  const cookieHeader = request.headers.get("cookie") || "";
  const storedState = parseStateCookie(cookieHeader);

  if (!storedState || storedState !== state) {
    return Response.redirect(new URL("/?auth_error=invalid_state", url.origin));
  }

  try {
    const callbackUrl = getCallbackUrl(request, GOOGLE_CONFIG.callbackPath);
    const accessToken = await exchangeCodeForToken(
      GOOGLE_CONFIG,
      code,
      callbackUrl
    );
    const profile = await fetchGoogleProfile(accessToken);
    const user = findOrCreateOAuthUser(
      "google",
      profile.providerAccountId,
      profile.email,
      profile.displayName,
      profile.avatarUrl
    );

    const sessionToken = createSession(user.id);
    const sessionCookie = `lottie-session=${sessionToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${isProduction ? "; Secure" : ""}`;

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": [sessionCookie, clearStateCookie(isProduction)].join(
          ", "
        ),
      },
    });
  } catch {
    return Response.redirect(
      new URL("/?auth_error=oauth_failed", url.origin)
    );
  }
}
