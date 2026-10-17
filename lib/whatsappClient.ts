"use client";

export type WhatsAppCallNotifyPayload = {
  to: string;
  tokenNumber: number;
  patientName: string;
  clinicName: string;
  doctorName: string;
};

export type WhatsAppCallNotifyResult = {
  ok: boolean;
  mode?: "live" | "mock";
  metaMessageId?: string;
  message?: string;
};

/** Fire-and-forget friendly helper used when a token is called. */
export async function notifyPatientWhatsApp(
  payload: WhatsAppCallNotifyPayload
): Promise<WhatsAppCallNotifyResult> {
  try {
    const response = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload)
    });

    const data = (await response.json().catch(() => ({}))) as {
      message?: string;
      mode?: "live" | "mock";
      metaMessageId?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        message: data.message ?? `WhatsApp send failed (${response.status}).`
      };
    }

    return {
      ok: true,
      mode: data.mode,
      metaMessageId: data.metaMessageId,
      message: data.message
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "WhatsApp send failed."
    };
  }
}
