// Shared search helpers (usable from server and client code).

// Lower-cases and folds Arabic spelling variants so "فستان" matches "فُستان",
// "أحمر" matches "احمر", "مدرسة" matches "مدرسه", and so on.
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "") // tashkeel + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660)) // Arabic-Indic digits
    .replace(/\s+/g, " ")
    .trim();
}

// True when every word typed appears somewhere in the haystack fields.
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const words = normalizeSearchText(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeSearchText(fields.filter(Boolean).join(" "));
  return words.every((word) => haystack.includes(word));
}

// Makes user input safe to drop into a PostgREST ilike / .or() filter:
// commas, parentheses and wildcards would otherwise break the filter string.
export function sanitizeForPostgrest(term: string): string {
  return term.replace(/[,()%*\\"]/g, " ").replace(/\s+/g, " ").trim();
}
