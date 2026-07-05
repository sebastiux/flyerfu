import { LeadInput } from "./types";

export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  value: LeadInput;
}

function str(input: unknown, max = 500): string {
  return typeof input === "string" ? input.trim().slice(0, max) : "";
}

// Accepts Mexican / international phone formats: digits, spaces, +, -, ().
// Requires at least 10 digits.
const PHONE_RE = /^[+\d][\d\s().-]{9,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate and normalize raw form input. Returns typed errors keyed by field
 * so the client can highlight them. Only name, phone and consent are required.
 */
export function validateLead(body: unknown): ValidationResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const name = str(b.name, 120);
  if (name.length < 2) {
    errors.name = "Por favor escribe tu nombre completo.";
  }

  const phone = str(b.phone, 40);
  const digits = phone.replace(/\D/g, "");
  if (!PHONE_RE.test(phone) || digits.length < 10) {
    errors.phone = "Ingresa un teléfono válido a 10 dígitos.";
  }

  const email = str(b.email, 160);
  if (email && !EMAIL_RE.test(email)) {
    errors.email = "El correo no parece válido.";
  }

  const consent = b.consent === true || b.consent === "true" || b.consent === "on";
  if (!consent) {
    errors.consent = "Necesitamos tu autorización para contactarte.";
  }

  const value: LeadInput = {
    name,
    phone,
    email: email || undefined,
    state: str(b.state, 80) || undefined,
    propertyType: str(b.propertyType, 40) || undefined,
    monthlyBill: str(b.monthlyBill, 40) || undefined,
    message: str(b.message, 1000) || undefined,
    consent,
  };

  return { ok: Object.keys(errors).length === 0, errors, value };
}
