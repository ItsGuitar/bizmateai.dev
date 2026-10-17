// Data Masking Adapter (NEW_DESIGN.md Section 7). Every call to a model goes through here first:
// company, buyer, supplier and contact names, tax IDs, bank accounts, phones, emails and
// addresses are swapped for anonymous tokens before anything leaves the system. Replies are
// unmasked back to real values before they ever reach the screen. Amounts are never masked, the
// model needs real numbers to reason, and numbers alone don't identify anyone.
//
// The mapping only ever exists in server memory for the life of one adapter instance; it is
// never sent to the model and never written to the client bundle.

export type MaskedFieldType =
  | "company"
  | "buyer"
  | "supplier"
  | "contact"
  | "tax_id"
  | "bank_account"
  | "phone"
  | "email"
  | "address";

export interface MaskEntry {
  type: MaskedFieldType;
  field: string;
  real: string;
  token: string;
}

const GROUP_PREFIX: Record<"buyer" | "supplier", string> = {
  buyer: "Buyer",
  supplier: "Supplier",
};

const SERIAL_PREFIX: Record<string, string> = {
  tax_id: "TAXID",
  bank_account: "ACCOUNT",
  phone: "PHONE",
  email: "EMAIL",
  address: "ADDRESS",
};

export class MaskingAdapter {
  private entries: MaskEntry[] = [];
  private tokenByReal = new Map<string, string>();
  private realByToken = new Map<string, string>();
  private groupCounters: Record<string, number> = {};
  private serialCounters: Record<string, number> = {};

  private registerEntry(type: MaskedFieldType, field: string, real: string, token: string) {
    this.tokenByReal.set(`${type}:${real}`, token);
    this.realByToken.set(token, real);
    this.entries.push({ type, field, real, token });
  }

  private nextGroupLetter(type: "buyer" | "supplier"): string {
    const n = (this.groupCounters[type] = (this.groupCounters[type] ?? 0) + 1);
    return String.fromCharCode(64 + n); // 1 -> A, 2 -> B, ...
  }

  // `field` is the human label shown on the Trust page's mapping table (e.g. "Buyer", "Tax ID"),
  // kept separate from `type` so two fields of the same type can carry different display labels.
  mask(type: MaskedFieldType, real: string | null | undefined, field: string, groupToken?: string): string | undefined {
    if (real === null || real === undefined || real === "") return real ?? undefined;

    const existing = this.tokenByReal.get(`${type}:${real}`);
    if (existing) return existing;

    let token: string;
    if (type === "company") {
      token = "Company_X";
    } else if (type === "buyer" || type === "supplier") {
      token = `${GROUP_PREFIX[type]}_${this.nextGroupLetter(type)}`;
    } else if (type === "contact") {
      const base = groupToken ?? "Buyer_A";
      const suffix = base.split("_")[1] ?? "A";
      const key = `contact:${suffix}`;
      const n = (this.serialCounters[key] = (this.serialCounters[key] ?? 0) + 1);
      token = `Person_${suffix}${n}`;
    } else {
      const n = (this.serialCounters[type] = (this.serialCounters[type] ?? 0) + 1);
      token = `${SERIAL_PREFIX[type]}_${String(n).padStart(3, "0")}`;
    }

    this.registerEntry(type, field, real, token);
    return token;
  }

  // Masks the named string fields of a plain object; every other field (amounts, dates, counts)
  // passes through untouched. `fieldTypes` maps each key that should be masked to its type.
  maskObject<T extends Record<string, unknown>>(
    obj: T,
    fieldTypes: Partial<Record<keyof T, { type: MaskedFieldType; field: string; groupKey?: keyof T }>>
  ): T {
    const out: Record<string, unknown> = { ...obj };
    for (const key of Object.keys(fieldTypes) as (keyof T)[]) {
      const spec = fieldTypes[key];
      const val = obj[key];
      if (spec && typeof val === "string") {
        const groupToken = spec.groupKey ? this.tokenByReal.get(`buyer:${String(obj[spec.groupKey])}`) : undefined;
        out[key as string] = this.mask(spec.type, val, spec.field, groupToken);
      }
    }
    return out as T;
  }

  // Swaps every known token in model output back to its real value before display.
  unmask(text: string): string {
    let result = text;
    const tokens = [...this.realByToken.keys()].sort((a, b) => b.length - a.length);
    for (const token of tokens) {
      const real = this.realByToken.get(token)!;
      result = result.split(token).join(real);
    }
    return result;
  }

  get mapping(): MaskEntry[] {
    return [...this.entries];
  }
}

export function createMaskingAdapter(): MaskingAdapter {
  return new MaskingAdapter();
}
