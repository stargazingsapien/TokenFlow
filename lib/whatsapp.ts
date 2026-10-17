import { getWhatsAppTemplateByName, MVP_WHATSAPP_TEMPLATE } from "./whatsappTemplates";

/** Same production sender as Digital-Clinic-Resident / CareDrip. */
export const DEFAULT_WHATSAPP_PHONE_NUMBER_ID = "1250532378149923";
export const DEFAULT_WHATSAPP_WABA_ID = "1901766070799050";
export const DEFAULT_WHATSAPP_API_VERSION = "v25.0";

export type TokenCallNotifyInput = {
  to: string;
  tokenNumber: number;
  patientName: string;
  clinicName: string;
  doctorName: string;
  templateName?: string;
  /** When set (UI send), used as-is for template body variables */
  bodyParams?: string[];
  /** Used by tf_almost_your_turn */
  patientsAhead?: number;
  /** Used by tf_almost_your_turn */
  waitMinutes?: number;
  /** Used by tf_doctor_delayed */
  delayMinutes?: number;
};

type WhatsAppTemplateResponse = {
  messages?: Array<{ id?: string }>;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

export function normalizeWhatsAppPhone(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  // Indian 10-digit mobiles → E.164 without plus for Cloud API
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }
  return digits;
}

export function getWhatsAppConfig() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() ?? "";
  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || DEFAULT_WHATSAPP_PHONE_NUMBER_ID;
  const wabaId =
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() ||
    process.env.WHATSAPP_WABA_ID?.trim() ||
    DEFAULT_WHATSAPP_WABA_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || DEFAULT_WHATSAPP_API_VERSION;
  const configuredMode = process.env.WHATSAPP_SEND_MODE?.trim().toLowerCase();
  const sendMode =
    configuredMode === "live" || configuredMode === "mock"
      ? configuredMode
      : accessToken
        ? "live"
        : "mock";

  if (sendMode === "live" && !accessToken) {
    throw new Error(
      "WhatsApp credentials are missing. Set WHATSAPP_ACCESS_TOKEN (same Meta token as Digital-Clinic / CareDrip)."
    );
  }

  return {
    accessToken,
    phoneNumberId,
    wabaId,
    apiVersion,
    sendMode
  };
}

function resolveCallTemplate(templateName?: string) {
  const preferred =
    templateName?.trim() ||
    process.env.WHATSAPP_CALL_TEMPLATE?.trim() ||
    MVP_WHATSAPP_TEMPLATE.name;

  return getWhatsAppTemplateByName(preferred) ?? MVP_WHATSAPP_TEMPLATE;
}

function buildBodyParams(templateName: string, input: TokenCallNotifyInput) {
  const patientName = input.patientName || `Patient #${input.tokenNumber}`;
  const tokenNumber = String(input.tokenNumber);
  const clinicDoctor = `${input.clinicName} / ${input.doctorName}`;

  switch (templateName) {
    case "tf_token_issued":
      return [patientName, tokenNumber, input.clinicName];
    case "tf_now_calling":
      return [patientName, tokenNumber, clinicDoctor];
    case "tf_almost_your_turn":
      return [
        patientName,
        String(input.patientsAhead ?? 0),
        String(input.waitMinutes ?? 0)
      ];
    case "tf_skipped_return":
      return [patientName, tokenNumber];
    case "tf_visit_completed":
      return [patientName, input.clinicName];
    case "tf_doctor_delayed":
      return [patientName, clinicDoctor, String(input.delayMinutes ?? input.waitMinutes ?? 10)];
    default:
      return [patientName, tokenNumber, clinicDoctor];
  }
}

/** Send a "now calling" style WhatsApp template for an OPD token. */
export async function sendWhatsAppTokenCall(input: TokenCallNotifyInput) {
  const config = getWhatsAppConfig();
  const template = resolveCallTemplate(input.templateName);
  const to = normalizeWhatsAppPhone(input.to);

  if (!to) {
    throw new Error("Recipient phone number is invalid.");
  }

  const bodyParams = (
    Array.isArray(input.bodyParams) && input.bodyParams.length > 0
      ? input.bodyParams.map((value) => String(value ?? "").trim())
      : buildBodyParams(template.name, input)
  ).slice(0, template.bodyParamsCount);

  if (bodyParams.length < template.bodyParamsCount || bodyParams.some((value) => !value)) {
    throw new Error(
      `Template ${template.name} needs ${template.bodyParamsCount} filled body variable(s).`
    );
  }
  const components =
    bodyParams.length > 0
      ? [
          {
            type: "body",
            parameters: bodyParams.map((text) => ({
              type: "text",
              text: String(text)
            }))
          }
        ]
      : [];

  const requestBody: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: template.name,
      language: { code: template.languageCode },
      ...(components.length > 0 ? { components } : {})
    }
  };

  if (config.sendMode !== "live") {
    return {
      metaMessageId: `mock_token_${input.tokenNumber}_${Date.now()}`,
      mode: "mock" as const,
      templateName: template.name,
      languageCode: template.languageCode,
      to,
      wabaId: config.wabaId,
      phoneNumberId: config.phoneNumberId,
      payload: {
        messages: [{ id: `mock_token_${input.tokenNumber}` }]
      }
    };
  }

  const response = await fetch(
    `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    }
  );

  const payload = (await response.json()) as WhatsAppTemplateResponse;

  if (!response.ok) {
    const code = payload.error?.code ? ` Code: ${payload.error.code}.` : "";
    const subcode = payload.error?.error_subcode
      ? ` Subcode: ${payload.error.error_subcode}.`
      : "";
    throw new Error(
      `${payload.error?.message ?? "Meta WhatsApp API rejected the message."}${code}${subcode}`
    );
  }

  return {
    metaMessageId: payload.messages?.[0]?.id,
    mode: "live" as const,
    templateName: template.name,
    languageCode: template.languageCode,
    to,
    wabaId: config.wabaId,
    phoneNumberId: config.phoneNumberId,
    payload
  };
}
