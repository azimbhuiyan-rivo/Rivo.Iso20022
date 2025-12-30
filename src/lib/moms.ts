export type MomsParseResult = {
  orgNr?: string;
  period?: string;
  momsBetala: number;
};

function num(s: string | null | undefined): number {
  if (!s) return 0;
  const n = Number(String(s).trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function digitsOnly(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

function stripDoctype(xml: string): string {
  return (xml ?? "").replace(/<!DOCTYPE[\s\S]*?>/i, "");
}

export function parseMomsXml(xmlText: string): MomsParseResult {
  const cleaned = stripDoctype(xmlText);

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleaned, "application/xml");
  const parseError = doc.getElementsByTagName("parsererror")[0];
  if (parseError) throw new Error("Invalid XML");

  const orgNrRaw = doc.getElementsByTagName("OrgNr")[0]?.textContent ?? undefined;
  const orgNr = orgNrRaw ? digitsOnly(String(orgNrRaw).trim()) : undefined;

  const momsNode = doc.getElementsByTagName("Moms")[0];
  const period = momsNode?.getElementsByTagName("Period")[0]?.textContent?.trim() ?? undefined;

  const momsBetalaText = momsNode?.getElementsByTagName("MomsBetala")[0]?.textContent ?? null;
  const momsBetala = num(momsBetalaText);

  return { orgNr, period, momsBetala };
}
