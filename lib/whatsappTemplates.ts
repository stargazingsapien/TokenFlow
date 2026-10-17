/**
 * Meta WhatsApp template registry — TokenFlow OPD queue only.
 * Wording avoids "token/OTP/code" so Meta classifies as Utility, not Authentication.
 * Submit these in Meta Business Manager; mark status approved after Meta review.
 */

export type WhatsAppTemplateStatus =
  | "approved"
  | "pending"
  | "test_number_only"
  | "rejected";

export type WhatsAppTemplateDefinition = {
  id: string;
  name: string;
  label: string;
  languageCode: string;
  status: WhatsAppTemplateStatus;
  headerParamsCount: number;
  bodyParamsCount: number;
  bodyParamLabels?: string[];
  description: string;
};

export const WHATSAPP_TEMPLATE_REGISTRY: WhatsAppTemplateDefinition[] = [
  {
    id: "tf_token_issued",
    name: "tf_token_issued",
    label: "Queue number issued — registered for OPD",
    languageCode: "en",
    status: "pending",
    headerParamsCount: 0,
    bodyParamsCount: 3,
    bodyParamLabels: ["Patient name", "Queue number", "Clinic name"],
    description:
      "Hi {{1}}, you are registered for OPD at {{3}}. Your queue number is {{2}}. Please wait at the clinic until you are called."
  },
  {
    id: "tf_now_calling",
    name: "tf_now_calling",
    label: "Now calling — please come in",
    languageCode: "en",
    status: "pending",
    headerParamsCount: 0,
    bodyParamsCount: 3,
    bodyParamLabels: ["Patient name", "Queue number", "Clinic / doctor"],
    description:
      "Hi {{1}}, queue number {{2}} is now being called at {{3}}. Please proceed to the consultation room."
  },
  {
    id: "tf_almost_your_turn",
    name: "tf_almost_your_turn",
    label: "Almost your turn — stay nearby",
    languageCode: "en",
    status: "pending",
    headerParamsCount: 0,
    bodyParamsCount: 3,
    bodyParamLabels: ["Patient name", "Patients ahead", "Estimated wait (minutes)"],
    description:
      "Hi {{1}}, you are almost next for your OPD visit. About {{2}} patient(s) ahead, estimated wait around {{3}} minutes. Please stay nearby."
  },
  {
    id: "tf_skipped_return",
    name: "tf_skipped_return",
    label: "Missed turn — return to reception",
    languageCode: "en",
    status: "pending",
    headerParamsCount: 0,
    bodyParamsCount: 2,
    bodyParamLabels: ["Patient name", "Queue number"],
    description:
      "Hi {{1}}, queue number {{2}} was missed. Please return to the clinic reception so we can help you."
  },
  {
    id: "tf_visit_completed",
    name: "tf_visit_completed",
    label: "Visit completed — thank you",
    languageCode: "en",
    status: "pending",
    headerParamsCount: 0,
    bodyParamsCount: 2,
    bodyParamLabels: ["Patient name", "Clinic name"],
    description:
      "Hi {{1}}, your OPD visit at {{2}} is complete. Thank you for visiting. Take care and follow any advice given by the doctor."
  },
  {
    id: "tf_doctor_delayed",
    name: "tf_doctor_delayed",
    label: "Doctor running late",
    languageCode: "en",
    status: "pending",
    headerParamsCount: 0,
    bodyParamsCount: 3,
    bodyParamLabels: ["Patient name", "Clinic / doctor", "Extra wait (minutes)"],
    description:
      "Hi {{1}}, consultations at {{2}} are running a little late by about {{3}} minutes. Please stay at the clinic; we will call your queue number soon."
  }
];

/** Default for Call next / Call specific until Meta approves and env overrides. */
export const MVP_WHATSAPP_TEMPLATE = WHATSAPP_TEMPLATE_REGISTRY.find(
  (template) => template.name === "tf_now_calling"
)!;

export function getWhatsAppTemplateByName(name: string) {
  return WHATSAPP_TEMPLATE_REGISTRY.find((template) => template.name === name) ?? null;
}

export function listApprovedWhatsAppTemplates() {
  return WHATSAPP_TEMPLATE_REGISTRY.filter((template) => template.status === "approved");
}

export function listTokenFlowTemplates() {
  return WHATSAPP_TEMPLATE_REGISTRY;
}
