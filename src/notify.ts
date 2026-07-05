import { Lead } from "./types";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
// Remitente. Debe ser de un dominio verificado en Resend. Para pruebas puedes
// usar el remitente de onboarding de Resend.
const RESEND_FROM = process.env.RESEND_FROM || "EcoValue Leads <onboarding@resend.dev>";
// Destinatarios: uno o varios correos separados por coma.
const LEAD_NOTIFY_TO = (process.env.LEAD_NOTIFY_TO || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** ¿Está configurado el envío de correo? */
export function emailEnabled(): boolean {
  return Boolean(RESEND_API_KEY && LEAD_NOTIFY_TO.length);
}

// Etiquetas legibles para los valores del formulario.
const PROPERTY_LABELS: Record<string, string> = {
  casa: "Casa habitación",
  negocio: "Comercio / Oficina",
  industria: "Industria",
  campo: "Agrícola / Campo",
};
const BILL_LABELS: Record<string, string> = {
  "0-1000": "Menos de $1,000",
  "1000-3000": "$1,000 – $3,000",
  "3000-6000": "$3,000 – $6,000",
  "6000+": "Más de $6,000",
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Enlace wa.me para responder al prospecto (antepone 52 si son 10 dígitos). */
function leadWhatsappLink(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.length === 10 ? "52" + digits : digits;
  return "https://wa.me/" + intl;
}

function renderRows(lead: Lead): string {
  const rows: [string, string | undefined][] = [
    ["Nombre", lead.name],
    ["Teléfono", lead.phone],
    ["Correo", lead.email],
    ["Tipo de inmueble", lead.propertyType ? PROPERTY_LABELS[lead.propertyType] || lead.propertyType : undefined],
    ["Consumo mensual", lead.monthlyBill ? BILL_LABELS[lead.monthlyBill] || lead.monthlyBill : undefined],
    ["Ubicación", lead.state],
    ["Campaña", lead.campaign],
    ["Fuente", lead.source],
  ];
  return rows
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr>
          <td style="padding:8px 12px;color:#55655c;font-size:13px;white-space:nowrap;vertical-align:top">${esc(k)}</td>
          <td style="padding:8px 12px;color:#142019;font-size:14px;font-weight:600">${esc(v)}</td>
        </tr>`
    )
    .join("");
}

function renderHtml(lead: Lead): string {
  const wa = leadWhatsappLink(lead.phone);
  const when = new Date(lead.createdAt).toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
  return `<!doctype html>
<html><body style="margin:0;background:#f5f8f4;font-family:Segoe UI,system-ui,-apple-system,Roboto,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <div style="background:#0f5132;color:#fff;padding:18px 22px;border-radius:14px 14px 0 0">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85">EcoValue · Nuevo lead solar</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">${esc(lead.name)}</div>
    </div>
    <div style="background:#fff;border:1px solid #e4ebe4;border-top:none;padding:8px 10px 18px">
      <table style="width:100%;border-collapse:collapse">${renderRows(lead)}</table>
      <div style="padding:14px 12px 4px">
        <a href="${esc(wa)}" style="display:inline-block;background:#25d366;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">
          Responder por WhatsApp
        </a>
        ${lead.email ? `<a href="mailto:${esc(lead.email)}" style="display:inline-block;margin-left:8px;color:#0f5132;text-decoration:none;font-weight:600;padding:12px 8px">Enviar correo</a>` : ""}
      </div>
    </div>
    <div style="color:#8a998f;font-size:12px;padding:12px 12px 0">Recibido el ${esc(when)} · ID ${esc(lead.id)}</div>
  </div>
</body></html>`;
}

function renderText(lead: Lead): string {
  const lines = [
    `Nuevo lead solar — EcoValue`,
    ``,
    `Nombre: ${lead.name}`,
    `Teléfono: ${lead.phone}`,
  ];
  if (lead.email) lines.push(`Correo: ${lead.email}`);
  if (lead.propertyType) lines.push(`Inmueble: ${PROPERTY_LABELS[lead.propertyType] || lead.propertyType}`);
  if (lead.monthlyBill) lines.push(`Consumo: ${BILL_LABELS[lead.monthlyBill] || lead.monthlyBill}`);
  if (lead.state) lines.push(`Ubicación: ${lead.state}`);
  if (lead.campaign) lines.push(`Campaña: ${lead.campaign}`);
  lines.push(``, `Responder por WhatsApp: ${leadWhatsappLink(lead.phone)}`);
  return lines.join("\n");
}

/**
 * Envía una notificación por correo con Resend. Es "fire-and-forget": los
 * errores se registran pero no interrumpen la captura del lead.
 */
export async function sendLeadEmail(lead: Lead): Promise<void> {
  if (!emailEnabled()) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: LEAD_NOTIFY_TO,
        subject: `Nuevo lead solar: ${lead.name}`,
        html: renderHtml(lead),
        text: renderText(lead),
        // Permite responder directo al correo del prospecto (si lo dejó).
        reply_to: lead.email || undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[resend] email failed (${res.status}): ${body}`);
    } else {
      console.log(`[resend] notification sent for lead ${lead.id}`);
    }
  } catch (err) {
    console.error("[resend] failed to send email:", err);
  }
}
