/**
 * Meta WhatsApp template registry — TokenFlow OPD queue only.
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
    label: "Token issued",
    languageCode: "en",
    status: "pending",
    headerParamsCount: 0,
    bodyParamsCount: 3,
    bodyParamLabels: ["Patient name", "Token number", "Clinic name"],
    description:
      "Hi {{1}}, your OPD token is #{{2}} at {{3}}. Please wait for your turn and keep this chat for updates."
  },
  {
    id: "tf_now_calling",
    name: "tf_now_calling",
    label: "Now calling",
    languageCode: "en",
    status: "pending",
    headerParamsCount: 0,
    bodyParamsCount: 3,
    bodyParamLabels: ["Patient name", "Token number", "Clinic / doctor"],
    description:
      "Hi {{1}}, Token #{{2}} is now being called at {{3}}. Please proceed to the doctor's room."
  },
  {
    id: "tf_almost_your_turn",
    name: "tf_almost_your_turn",
    label: "Almost your turn",
    languageCode: "en",
    status: "pending",
    headerParamsCount: 0,
    bodyParamsCount: 3,
    bodyParamLabels: ["Patient name", "Patients ahead", "Estimated wait (minutes)"],
    description:
      "Hi {{1}}, you are almost next. About {{2}} patient(s) ahead — estimated wait ~{{3}} minutes. Please stay nearby."
  },
  {
    id: "tf_skipped_return",
    name: "tf_skipped_return",
    label: "Skipped — return to reception",
    languageCode: "en",
    status: "pending",
    headerParamsCount: 0,
    bodyParamsCount: 2,
    bodyParamLabels: ["Patient name", "Token number"],
    description:
      "Hi {{1}}, Token #{{2}} was skipped. Please return to reception so we can assist you."
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
