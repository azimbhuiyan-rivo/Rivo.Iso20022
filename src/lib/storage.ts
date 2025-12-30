import type { Profile, RunInput } from "./types";

export type HistoryEntry = {
  id: string;
  createdAt: string;
  run: RunInput;
  agiPeriod?: string;
  salariesXml: string | null;
  paymentsXml: string | null;
};

const PROFILE_KEY = "rivo.pain001.profile.v1";
const HISTORY_KEY = "rivo.pain001.history.v1";

export function defaultProfile(): Profile {
  return {
    initiatorName: "Rivo Tech AB",
    senderId: "",
    senderScheme: "CUST",
    debtorIban: "",
    debtorBic: "",
    skvBg: "",
    skvOcr: "",
    tele2Bg: "",
    lansforsakringarBg: "",
    employees: {
      azim: { personnummer: "", clearingAccount: "" },
      aynun: { personnummer: "", clearingAccount: "" },
    },
  };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return defaultProfile();

    const base = defaultProfile();
    const parsed = JSON.parse(raw) as Partial<Profile>;

    return {
      ...base,
      ...parsed,
      employees: {
        ...base.employees,
        ...(parsed.employees ?? {}),
        azim: {
          ...base.employees.azim,
          ...(parsed.employees?.azim ?? {}),
        },
        aynun: {
          ...base.employees.aynun,
          ...(parsed.employees?.aynun ?? {}),
        },
      },
    };
  } catch {
    return defaultProfile();
  }
}

export function saveProfile(p: Profile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

export function makeHistoryEntry(run: RunInput, salariesXml: string | null, paymentsXml: string | null, agiPeriod?: string): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    run,
    agiPeriod,
    salariesXml,
    paymentsXml,
  };
}
