// Language filtering for the Mock Document Generator's trilingual labels. Every mixed-language
// string in the generator (titles, column headers, role labels) is built from a MultiLangLabel so
// the page's language checkboxes can show/hide each language consistently, always in the same
// English / Chinese / Thai order.

export type LanguageCode = "en" | "zh" | "th";

export const ALL_LANGUAGES: LanguageCode[] = ["en", "zh", "th"];

export interface MultiLangLabel {
  en: string;
  zh?: string;
  th?: string;
}

export function L(en: string, zh?: string, th?: string): MultiLangLabel {
  return { en, zh, th };
}

export function renderLabel(label: MultiLangLabel, active: Set<LanguageCode>): string {
  const parts: string[] = [];
  if (active.has("en") && label.en) parts.push(label.en);
  if (active.has("zh") && label.zh) parts.push(label.zh);
  if (active.has("th") && label.th) parts.push(label.th);
  return parts.length > 0 ? parts.join(" / ") : label.en;
}
