import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ message: "Webhook verification failed." }, { status: 403 });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);

  return NextResponse.json({
    received: true,
    entries: Array.isArray(payload?.entry) ? payload.entry.length : 0
  });
}
