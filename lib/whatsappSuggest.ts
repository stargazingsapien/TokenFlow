import {
  WhatsAppTemplateDefinition,
  getWhatsAppTemplateByName,
  listTokenFlowTemplates
} from "./whatsappTemplates";

export type WhatsAppSuggestContext = {
  patientName?: string;
  tokenNumber?: number;
  clinicName?: string;
  doctorName?: string;
  patientsAhead?: number;
  waitMinutes?: number;
  delayMinutes?: number;
};

/** Prefill body {{n}} values from the selected patient / queue context. */
export function suggestBodyParams(
  template: WhatsAppTemplateDefinition,
  ctx: WhatsAppSuggestContext
): string[] {
  const patientName = ctx.patientName?.trim() || (ctx.tokenNumber ? `Patient #${ctx.tokenNumber}` : "");
  const tokenNumber = ctx.tokenNumber ? String(ctx.tokenNumber) : "";
  const clinicName = ctx.clinicName?.trim() || "";
  const clinicDoctor = [clinicName, ctx.doctorName?.trim()].filter(Boolean).join(" / ");

  switch (template.name) {
    case "tf_token_issued":
      return [patientName, tokenNumber, clinicName];
    case "tf_now_calling":
      return [patientName, tokenNumber, clinicDoctor];
    case "tf_almost_your_turn":
      return [
        patientName,
        String(ctx.patientsAhead ?? 0),
        String(ctx.waitMinutes ?? 0)
      ];
    case "tf_skipped_return":
      return [patientName, tokenNumber];
    case "tf_visit_completed":
      return [patientName, clinicName];
    case "tf_doctor_delayed":
      return [patientName, clinicDoctor, String(ctx.delayMinutes ?? ctx.waitMinutes ?? 10)];
    default:
      return Array.from({ length: template.bodyParamsCount }, () => "");
  }
}

export function renderTemplatePreview(template: WhatsAppTemplateDefinition, bodyParams: string[]) {
  return template.description.replace(/\{\{(\d+)\}\}/g, (_, rawIndex: string) => {
    const index = Number(rawIndex) - 1;
    const value = bodyParams[index]?.trim();
    return value || `{{${rawIndex}}}`;
  });
}

export { getWhatsAppTemplateByName, listTokenFlowTemplates };
