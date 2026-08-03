/** Splits the backend's free-text submit message into a clean summary and the gatepass no, if present. */
export function parseSubmitMessage(raw: string): { summary: string; gatepassNo: string | null } {
  const text = raw.trim().replace(/^(success|error)\s*-?\s*:\s*/i, "");

  // Prefer chopping from a "Gatepass no: PGI..." style label onward (reads cleanest).
  const labeled = text.match(/gate\s*pass\s*(?:no\.?)?\s*[:-]*\s*(PGI\d+)/i);
  if (labeled && labeled.index !== undefined) {
    const summary = text.slice(0, labeled.index).trim().replace(/[.,:-]+$/, "");
    return { summary, gatepassNo: labeled[1] };
  }

  // Otherwise the code is embedded mid-sentence (e.g. an error message) - just excise it.
  const bare = text.match(/PGI\d+/i);
  if (!bare) return { summary: text, gatepassNo: null };
  const summary = text
    .replace(new RegExp(`[\\s:-]*${bare[0]}[\\s:-]*`, "i"), " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/[.,]$/, "");
  return { summary, gatepassNo: bare[0] };
}
