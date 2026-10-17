"use client";

import { estimateDynamicWait, TokenRecord } from "@/lib/queue";
import {
  listTokenFlowTemplates,
  renderTemplatePreview,
  suggestBodyParams
} from "@/lib/whatsappSuggest";
import { notifyPatientWhatsApp } from "@/lib/whatsappClient";
import { useQueue } from "./QueueProvider";
import { useEffect, useMemo, useState } from "react";

const templates = listTokenFlowTemplates();

export function WhatsAppSendPanel() {
  const { queue, stats } = useQueue();

  const patientsWithPhone = useMemo(
    () =>
      [...queue.tokens]
        .filter((token) => Boolean(token.patientPhone?.trim()))
        .sort((a, b) => b.tokenNumber - a.tokenNumber),
    [queue.tokens]
  );

  const [selectedTokenNumber, setSelectedTokenNumber] = useState<number | "">("");
  const [manualPhone, setManualPhone] = useState("");
  const [templateName, setTemplateName] = useState(templates[1]?.name ?? templates[0]?.name ?? "");
  const [bodyParams, setBodyParams] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.name === templateName) ?? templates[0],
    [templateName]
  );

  const selectedPatient: TokenRecord | undefined = useMemo(
    () => queue.tokens.find((token) => token.tokenNumber === selectedTokenNumber),
    [queue.tokens, selectedTokenNumber]
  );

  const waitEstimate = useMemo(() => {
    if (!selectedPatient) return null;
    return estimateDynamicWait(queue, selectedPatient.tokenNumber);
  }, [queue, selectedPatient]);

  // Prefill variables when patient or template changes
  useEffect(() => {
    if (!selectedTemplate) return;

    setBodyParams(
      suggestBodyParams(selectedTemplate, {
        patientName: selectedPatient?.patientName,
        tokenNumber: selectedPatient?.tokenNumber,
        clinicName: queue.clinicName,
        doctorName: queue.doctorName,
        patientsAhead: waitEstimate?.patientsAhead,
        waitMinutes: waitEstimate?.waitMinutes,
        delayMinutes: 10
      })
    );
  }, [
    selectedTemplate,
    selectedPatient?.patientName,
    selectedPatient?.tokenNumber,
    queue.clinicName,
    queue.doctorName,
    waitEstimate?.patientsAhead,
    waitEstimate?.waitMinutes
  ]);

  useEffect(() => {
    if (selectedPatient?.patientPhone) {
      setManualPhone(selectedPatient.patientPhone);
    }
  }, [selectedPatient?.patientPhone]);

  const preview = useMemo(() => {
    if (!selectedTemplate) return "";
    return renderTemplatePreview(selectedTemplate, bodyParams);
  }, [selectedTemplate, bodyParams]);

  const updateParam = (index: number, value: string) => {
    setBodyParams((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTemplate) return;

    const to = manualPhone.trim();
    if (!to) {
      setStatusOk(false);
      setStatusMessage("Enter a WhatsApp phone number.");
      return;
    }

    const missing = bodyParams
      .slice(0, selectedTemplate.bodyParamsCount)
      .findIndex((value) => !String(value ?? "").trim());
    if (missing >= 0) {
      setStatusOk(false);
      setStatusMessage(
        `Fill variable {{${missing + 1}}} (${selectedTemplate.bodyParamLabels?.[missing] ?? "required"}).`
      );
      return;
    }

    setIsSending(true);
    setStatusMessage(null);

    const tokenNumber = selectedPatient?.tokenNumber || Number(bodyParams[1]) || 1;

    const result = await notifyPatientWhatsApp({
      to,
      tokenNumber,
      patientName: selectedPatient?.patientName || bodyParams[0] || `Patient #${tokenNumber}`,
      clinicName: queue.clinicName,
      doctorName: queue.doctorName,
      templateName: selectedTemplate.name,
      bodyParams: bodyParams.slice(0, selectedTemplate.bodyParamsCount),
      patientsAhead: waitEstimate?.patientsAhead,
      waitMinutes: waitEstimate?.waitMinutes
    });

    setIsSending(false);
    setStatusOk(result.ok);
    setStatusMessage(
      result.ok
        ? `${result.message ?? "Sent."}${result.mode ? ` (${result.mode})` : ""}${
            result.metaMessageId ? ` · ${result.metaMessageId}` : ""
          }`
        : result.message ?? "Send failed."
    );
  };

  return (
    <div className="rounded-2xl border border-white/80 bg-white p-6 shadow-panel">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-emerald-100 p-2 text-xl text-emerald-700">💬</span>
          <div>
            <h2 className="text-lg font-black text-ink">WhatsApp message</h2>
            <p className="text-xs font-semibold text-slate-500">
              Pick a template, fill variables, then send (works in mock until Meta approves)
            </p>
          </div>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
          {stats.waitingCount} waiting
        </span>
      </div>

      <form onSubmit={handleSend} className="mt-4 grid gap-3.5">
        <label className="grid gap-1 text-xs font-bold text-slate-600">
          Patient (with phone)
          <select
            value={selectedTokenNumber === "" ? "" : String(selectedTokenNumber)}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedTokenNumber(value ? Number(value) : "");
            }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-ink transition focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/20"
          >
            <option value="">Manual phone / no patient selected</option>
            {patientsWithPhone.map((token) => (
              <option key={token.tokenNumber} value={token.tokenNumber}>
                #{token.tokenNumber} · {token.patientName} · {token.patientPhone} · {token.status}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-bold text-slate-600">
          WhatsApp number
          <input
            type="tel"
            required
            placeholder="10-digit Indian mobile"
            value={manualPhone}
            onChange={(event) => setManualPhone(event.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-ink transition focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/20"
          />
        </label>

        <label className="grid gap-1 text-xs font-bold text-slate-600">
          Template
          <select
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-ink transition focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/20"
          >
            {templates.map((template) => (
              <option key={template.name} value={template.name}>
                {template.label}
              </option>
            ))}
          </select>
        </label>

        {selectedTemplate && (
          <div className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Template variables
            </p>
            {Array.from({ length: selectedTemplate.bodyParamsCount }).map((_, index) => (
              <label key={index} className="grid gap-1 text-xs font-bold text-slate-600">
                {`{{${index + 1}}} — ${selectedTemplate.bodyParamLabels?.[index] ?? `Variable ${index + 1}`}`}
                <input
                  type="text"
                  required
                  value={bodyParams[index] ?? ""}
                  onChange={(event) => updateParam(index, event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition focus:border-mint focus:outline-none focus:ring-2 focus:ring-mint/20"
                />
              </label>
            ))}
          </div>
        )}

        {selectedTemplate && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Preview</p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-ink">{preview}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSending}
          className="rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSending ? "Sending…" : "Send WhatsApp"}
        </button>

        {statusMessage && (
          <div
            className={`rounded-xl border p-3 text-xs font-bold ${
              statusOk
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {statusMessage}
          </div>
        )}
      </form>
    </div>
  );
}
