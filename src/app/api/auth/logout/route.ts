import { deleteSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)lottie-session=([^\s;]+)/);

  if (match) {
    deleteSession(match[1]);
  }

  const cookie = "lottie-session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";

  return Response.json({ ok: true }, {
    headers: { "Set-Cookie": cookie },
  });
}
