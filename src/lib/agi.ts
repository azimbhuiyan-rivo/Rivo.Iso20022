export type AgiEmployee = { personId: string; gross: number; tax: number };
export type AgiParseResult = {
  period?: string;
  totalsAgi: number;
  totalsAvdragenSkatt: number;
  byPersonId: Map<string, AgiEmployee>;
};

function num(s: string | null | undefined): number {
  if (!s) return 0;
  const n = Number(String(s).trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function digitsOnly(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

export function parseAgiXml(xmlText: string): AgiParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const parseError = doc.getElementsByTagName("parsererror")[0];
  if (parseError) throw new Error("Invalid XML");

  const blanketter = Array.from(doc.getElementsByTagNameNS("*", "Blankett"));

  let period: string | undefined;
  let totalsAgi = 0;
  let totalsSkatt = 0;

  const byPersonId = new Map<string, AgiEmployee>();

  for (const b of blanketter) {
    const hu = b.getElementsByTagNameNS("*", "HU")[0];
    if (hu) {
      const p = b.getElementsByTagNameNS("*", "RedovisningsPeriod")[0]?.textContent ?? undefined;
      if (p) period = String(p).trim();
      totalsAgi = num(b.getElementsByTagNameNS("*", "SummaArbAvgSlf")[0]?.textContent);
      totalsSkatt = num(b.getElementsByTagNameNS("*", "SummaSkatteavdr")[0]?.textContent);
      continue;
    }

    const iu = b.getElementsByTagNameNS("*", "IU")[0];
    if (iu) {
      const pidRaw = b.getElementsByTagNameNS("*", "BetalningsmottagarId")[0]?.textContent ?? "";
      const personId = digitsOnly(pidRaw);
      if (!personId) continue;

      const gross = num(b.getElementsByTagNameNS("*", "KontantErsattningUlagAG")[0]?.textContent);
      const tax = num(b.getElementsByTagNameNS("*", "AvdrPrelSkatt")[0]?.textContent);

      byPersonId.set(personId, { personId, gross, tax });
    }
  }

  return { period, totalsAgi, totalsAvdragenSkatt: totalsSkatt, byPersonId };
}
