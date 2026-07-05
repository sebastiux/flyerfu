/** Shape of the data submitted by the public lead form. */
export interface LeadInput {
  name: string;
  phone: string;
  email?: string;
  /** State / region of the property (helps route the sales visit). */
  state?: string;
  /** Type of property: casa (home), negocio (business), industria, etc. */
  propertyType?: string;
  /** Approximate monthly electricity bill in MXN. */
  monthlyBill?: string;
  /** Free-text message / notes from the prospect. */
  message?: string;
  /** Whether the prospect accepted to be contacted (privacy consent). */
  consent?: boolean;
}

/** A lead persisted to storage, enriched with server-side metadata. */
export interface Lead extends LeadInput {
  id: string;
  createdAt: string;
  /** Marketing attribution captured from the URL (?utm_source=...). */
  source?: string;
  campaign?: string;
  /** Meta / Facebook click id, useful for conversion tracking. */
  fbclid?: string;
  userAgent?: string;
  ip?: string;
}
