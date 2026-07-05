import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";
import path from "path";
import { Lead } from "./types";
import { validateLead } from "./validate";
import { exportCsv, readLeads, saveLead } from "./store";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const LEAD_WEBHOOK_URL = process.env.LEAD_WEBHOOK_URL || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
// WhatsApp destino: solo dígitos, formato internacional (país + número).
// Default: +52 1 55 1059 7019 -> 5215510597019
const WHATSAPP_NUMBER = (process.env.WHATSAPP_NUMBER || "5215510597019").replace(/\D/g, "");

app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));

// --- CORS (so the form can be posted from a Facebook canvas / other origin) ---
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// --- Very small in-memory rate limiter to blunt spam/abuse of the form ---
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    next();
    return;
  }
  if (entry.count >= RATE_MAX) {
    res.status(429).json({ ok: false, error: "Demasiadas solicitudes, intenta más tarde." });
    return;
  }
  entry.count += 1;
  next();
}

// Occasionally purge stale rate-limit entries so the map cannot grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits) if (now > entry.resetAt) hits.delete(ip);
}, RATE_WINDOW_MS).unref();

/** Forward a captured lead to an external webhook (CRM/Zapier/etc.), if configured. */
async function forwardToWebhook(lead: Lead): Promise<void> {
  if (!LEAD_WEBHOOK_URL) return;
  try {
    await fetch(LEAD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    });
  } catch (err) {
    console.error("[webhook] failed to forward lead:", err);
  }
}

// --- Public API: capture a lead --------------------------------------------
app.post("/api/leads", rateLimit, async (req: Request, res: Response) => {
  // Honeypot: bots fill hidden fields. Silently accept but discard.
  if (typeof req.body?.company === "string" && req.body.company.trim() !== "") {
    res.status(200).json({ ok: true });
    return;
  }

  const { ok, errors, value } = validateLead(req.body);
  if (!ok) {
    res.status(400).json({ ok: false, errors });
    return;
  }

  const q = req.body || {};
  const lead: Lead = {
    ...value,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    source: typeof q.source === "string" ? q.source.slice(0, 120) : undefined,
    campaign: typeof q.campaign === "string" ? q.campaign.slice(0, 120) : undefined,
    fbclid: typeof q.fbclid === "string" ? q.fbclid.slice(0, 255) : undefined,
    userAgent: (req.headers["user-agent"] || "").slice(0, 255),
    ip: req.ip,
  };

  try {
    await saveLead(lead);
  } catch (err) {
    console.error("[leads] failed to save:", err);
    res.status(500).json({ ok: false, error: "No se pudo guardar. Intenta de nuevo." });
    return;
  }

  // Fire-and-forget forwarding; the prospect shouldn't wait on the CRM.
  void forwardToWebhook(lead);

  console.log(`[leads] captured ${lead.id} — ${lead.name} (${lead.phone})`);
  res.status(201).json({ ok: true, id: lead.id });
});

// --- Admin: guarded lead listing + CSV export ------------------------------
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!ADMIN_TOKEN) {
    res.status(403).json({ ok: false, error: "Admin deshabilitado (falta ADMIN_TOKEN)." });
    return;
  }
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.query.token as string) || "";
  if (token !== ADMIN_TOKEN) {
    res.status(401).json({ ok: false, error: "No autorizado." });
    return;
  }
  next();
}

app.get("/api/leads", requireAdmin, async (_req: Request, res: Response) => {
  const leads = await readLeads();
  res.json({ ok: true, count: leads.length, leads });
});

app.get("/api/leads.csv", requireAdmin, async (_req: Request, res: Response) => {
  const csv = await exportCsv();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="leads.csv"');
  res.send(csv);
});

// Public config consumed by the front-end (e.g. the WhatsApp destination).
app.get("/api/config", (_req: Request, res: Response) => {
  res.json({ whatsappNumber: WHATSAPP_NUMBER });
});

app.get("/health", (_req: Request, res: Response) => res.json({ ok: true }));

// --- Static landing page ----------------------------------------------------
app.use(express.static(path.join(__dirname, "..", "public")));

app.listen(PORT, () => {
  console.log(`EcoValue lead capturer running at http://localhost:${PORT}`);
  if (!ADMIN_TOKEN) console.log("[warn] ADMIN_TOKEN not set — admin endpoints are disabled.");
});
