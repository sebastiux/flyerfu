import { promises as fs } from "fs";
import path from "path";
import { Lead } from "./types";

// Configurable para apuntar a un volumen persistente en producción
// (p. ej. DATA_DIR=/app/data en Railway). Por defecto: ./data del proyecto.
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, "..", "data");
const JSON_PATH = path.join(DATA_DIR, "leads.json");
const CSV_PATH = path.join(DATA_DIR, "leads.csv");

const CSV_COLUMNS: (keyof Lead)[] = [
  "id",
  "createdAt",
  "name",
  "phone",
  "email",
  "state",
  "propertyType",
  "monthlyBill",
  "message",
  "consent",
  "source",
  "campaign",
  "fbclid",
];

/** Escape a value for safe inclusion in a CSV cell. */
function csvCell(value: unknown): string {
  const str = value === undefined || value === null ? "" : String(value);
  // Prefix formula-like values to prevent CSV injection in spreadsheets.
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/** Read all persisted leads (newest first is NOT guaranteed; array order = insertion). */
export async function readLeads(): Promise<Lead[]> {
  try {
    const raw = await fs.readFile(JSON_PATH, "utf8");
    return JSON.parse(raw) as Lead[];
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

/**
 * Append a lead to both the JSON store and a CSV export.
 * A module-level promise chain serializes writes so concurrent form
 * submissions cannot clobber each other's data (read-modify-write race).
 */
let writeChain: Promise<void> = Promise.resolve();

export function saveLead(lead: Lead): Promise<void> {
  writeChain = writeChain.then(async () => {
    await ensureDataDir();
    const leads = await readLeads();
    leads.push(lead);
    await fs.writeFile(JSON_PATH, JSON.stringify(leads, null, 2), "utf8");

    const header = CSV_COLUMNS.join(",") + "\n";
    const row =
      CSV_COLUMNS.map((col) => csvCell(lead[col])).join(",") + "\n";
    try {
      await fs.access(CSV_PATH);
      await fs.appendFile(CSV_PATH, row, "utf8");
    } catch {
      await fs.writeFile(CSV_PATH, header + row, "utf8");
    }
  });
  return writeChain;
}

/** Build a CSV string of all leads on demand (for the export endpoint). */
export async function exportCsv(): Promise<string> {
  const leads = await readLeads();
  const header = CSV_COLUMNS.join(",");
  const rows = leads.map((lead) =>
    CSV_COLUMNS.map((col) => csvCell(lead[col])).join(",")
  );
  return [header, ...rows].join("\n");
}
