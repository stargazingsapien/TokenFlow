import { NextResponse } from "next/server";
import { SESSION_COOKIE, isStaffSession } from "@/lib/auth";
import { sendWhatsAppTokenCall } from "@/lib/whatsapp";

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const session = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);

  if (!isStaffSession(session)) {
    return NextResponse.json({ message: "Unauthorized. Staff login required." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => null)) as
      | {
          to?: string;
          tokenNumber?: number;
          patientName?: string;
          clinicName?: string;
          doctorName?: string;
          templateName?: string;
        }
      | null;

    const to = String(body?.to ?? "").trim();
    const tokenNumber = Number(body?.tokenNumber);

    if (!to || !Number.isFinite(tokenNumber) || tokenNumber <= 0) {
      return NextResponse.json(
        { message: "Missing required fields: to, tokenNumber." },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppTokenCall({
      to,
      tokenNumber,
      patientName: String(body?.patientName ?? `Patient #${tokenNumber}`),
      clinicName: String(body?.clinicName ?? "TokenFlow Clinic"),
      doctorName: String(body?.doctorName ?? "Doctor"),
      templateName: body?.templateName
    });

    return NextResponse.json({
      message:
        result.mode === "mock"
          ? "WhatsApp mock send recorded (set WHATSAPP_ACCESS_TOKEN for live)."
          : "WhatsApp message sent.",
      mode: result.mode,
      metaMessageId: result.metaMessageId,
      to: result.to,
      templateName: result.templateName,
      phoneNumberId: result.phoneNumberId,
      wabaId: result.wabaId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send WhatsApp message.";
    return NextResponse.json({ message }, { status: 400 });
  }
}
