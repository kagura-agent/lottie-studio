export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const eventType = body.type as string;

  // Log webhook event for debugging (no actual Stripe processing yet)
  console.log(`[stripe-webhook] Received event: ${eventType}`, {
    id: body.id,
    type: eventType,
    created: body.created,
  });

  return Response.json({ received: true });
}
