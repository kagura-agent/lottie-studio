import {
  hashPassword,
  createUser,
  findUserByEmail,
  createSession,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";
import {
  checkAuthRate,
  sanitizeEmail,
  validateEmail,
  validatePassword,
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

  let body: { email?: string; password?: string; displayName?: string };
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

  const pw = body.password || "";
  const passwordError = validatePassword(pw);
  if (passwordError) {
    return Response.json({ error: passwordError }, { status: 400 });
  }

  const existing = findUserByEmail(email);
  if (existing) {
    return Response.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await hashPassword(body.password!);
  const user = createUser(email, passwordHash, body.displayName);
  const token = createSession(user.id);

  const isProduction = process.env.NODE_ENV === "production";
  const cookie = `lottie-session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${isProduction ? "; Secure" : ""}`;

  return Response.json({ user }, {
    status: 201,
    headers: { "Set-Cookie": cookie },
  });
}
