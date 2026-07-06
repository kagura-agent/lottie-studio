import {
  GITHUB_CONFIG,
  generateState,
  buildAuthorizeUrl,
  buildStateCookie,
  getCallbackUrl,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!GITHUB_CONFIG.clientId) {
    return Response.json(
      { error: "GitHub OAuth is not configured" },
      { status: 501 }
    );
  }

  const state = generateState();
  const callbackUrl = getCallbackUrl(request, GITHUB_CONFIG.callbackPath);
  const authorizeUrl = buildAuthorizeUrl(GITHUB_CONFIG, state, callbackUrl);
  const isProduction = process.env.NODE_ENV === "production";

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl,
      "Set-Cookie": buildStateCookie(state, isProduction),
    },
  });
}
