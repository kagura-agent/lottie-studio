import {
  verifyPassword,
  findUserByEmail,
  createSession,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";
import {
  checkAuthRate,
  sanitizeEmail,
  validateEmail,
} from "@/lib/auth-middleware";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rateResult = checkAuthRate(request);
  if (!rateResult.ok) {
    return Response.json(
      { error: "Too many attempts. Please try again later.", retryAfterSec: rateResult.retryAfterSec },
      { status: 429 }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const email = sanitizeEmail(body.email || "");
  const emailError = validateEmail(email);
  if (emailError) {
    return Response.json({ error: emailError }, { status: 400 });
  }

  if (!body.password) {
    return Response.json({ error: "Password is required" }, { status: 400 });
  }

  const user = findUserByEmail(email);
  if (!user) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = createSession(user.id);

  const isProduction = process.env.NODE_ENV === "production";
  const cookie = `lottie-session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${isProduction ? "; Secure" : ""}`;

  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
    },
  }, {
    headers: { "Set-Cookie": cookie },
  });
}
