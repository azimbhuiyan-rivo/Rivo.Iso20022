import React, { useEffect, useMemo, useState } from "react";
import type { Profile } from "../lib/types";

type Props = {
  profile: Profile;
  onChange: (p: Profile) => void;
};

function onlyDigits(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

export function ProfilePage({ profile, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Profile>(profile);

  useEffect(() => {
    if (!editing) setDraft(profile);
  }, [profile, editing]);

  const missing = useMemo(() => {
    const p = draft;
    const m: string[] = [];
    if (!p.senderId) m.push("Sender ID");
    if (!p.debtorIban) m.push("Debtor IBAN");
    if (!p.debtorBic) m.push("Debtor BIC");
    if (!p.skvBg) m.push("Skatteverket BG");
    if (!p.skvOcr) m.push("Skatteverket OCR");
    if (!p.tele2Bg) m.push("Tele2 BG");
    if (!p.employees.azim.personnummer) m.push("Azim personnummer");
    if (!p.employees.azim.clearingAccount) m.push("Azim clearing+account");
    if (!p.employees.aynun.personnummer) m.push("Aynun personnummer");
    if (!p.employees.aynun.clearingAccount) m.push("Aynun clearing+account");
    return m;
  }, [draft]);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft({ ...draft, [key]: value });
  }

  function save() {
    onChange(draft);
    setEditing(false);
  }

  function cancel() {
    setDraft(profile);
    setEditing(false);
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="h" style={{ marginBottom: 0 }}>
          Profile (stored locally)
        </h2>

        {!editing ? (
          <button className="primary" onClick={() => setEditing(true)}>
            Edit
          </button>
        ) : (
          <div className="btnRow" style={{ marginTop: 0 }}>
            <button className="primary" onClick={save}>
              Save
            </button>
            <button onClick={cancel}>Cancel</button>
          </div>
        )}
      </div>

      {missing.length > 0 && <div className="small warn">Missing: {missing.join(", ")}</div>}
      {missing.length === 0 && <div className="small ok">Profile looks complete.</div>}

      <div className={!editing ? "readonlyPanel" : ""}>
        <div className="row">
          <div className="col">
            <label>Initiator / company name</label>
            <input disabled={!editing} value={draft.initiatorName} onChange={(e) => set("initiatorName", e.target.value)} />

            <label>Sender ID</label>
            <input disabled={!editing} value={draft.senderId} onChange={(e) => set("senderId", onlyDigits(e.target.value))} />

            <label>Sender scheme</label>
            <select disabled={!editing} value={draft.senderScheme} onChange={(e) => set("senderScheme", e.target.value as any)}>
              <option value="CUST">CUST</option>
              <option value="BANK">BANK</option>
            </select>

            <label>Debtor IBAN</label>
            <input disabled={!editing} value={draft.debtorIban} onChange={(e) => set("debtorIban", e.target.value.trim())} />

            <label>Debtor BIC</label>
            <input disabled={!editing} value={draft.debtorBic} onChange={(e) => set("debtorBic", e.target.value.trim())} />

            <label>Skatteverket BG</label>
            <input disabled={!editing} value={draft.skvBg} onChange={(e) => set("skvBg", onlyDigits(e.target.value))} />

            <label>Skatteverket OCR</label>
            <input disabled={!editing} value={draft.skvOcr} onChange={(e) => set("skvOcr", onlyDigits(e.target.value))} />

            <label>Tele2 BG</label>
            <input disabled={!editing} value={draft.tele2Bg} onChange={(e) => set("tele2Bg", onlyDigits(e.target.value))} />

            <div className="small" style={{ marginTop: 10 }}>
              Stored in your browser (localStorage). Not pushed to GitHub Pages.
            </div>
          </div>

          <div className="col">
            <h3 className="h3">Employees (AGI mapping)</h3>

            <label>Azim personnummer</label>
            <input
              disabled={!editing}
              value={draft.employees.azim.personnummer}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  employees: {
                    ...draft.employees,
                    azim: { ...draft.employees.azim, personnummer: onlyDigits(e.target.value) },
                  },
                })
              }
            />

            <label>Azim clearing+account</label>
            <input
              disabled={!editing}
              value={draft.employees.azim.clearingAccount}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  employees: {
                    ...draft.employees,
                    azim: { ...draft.employees.azim, clearingAccount: onlyDigits(e.target.value) },
                  },
                })
              }
            />

            <label>Aynun personnummer</label>
            <input
              disabled={!editing}
              value={draft.employees.aynun.personnummer}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  employees: {
                    ...draft.employees,
                    aynun: { ...draft.employees.aynun, personnummer: onlyDigits(e.target.value) },
                  },
                })
              }
            />

            <label>Aynun clearing+account</label>
            <input
              disabled={!editing}
              value={draft.employees.aynun.clearingAccount}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  employees: {
                    ...draft.employees,
                    aynun: { ...draft.employees.aynun, clearingAccount: onlyDigits(e.target.value) },
                  },
                })
              }
            />
          </div>
        </div>
      </div>

      {!editing && <div className="small" style={{ marginTop: 10 }}>Profile is locked. Click <b>Edit</b> to change values.</div>}
    </div>
  );
}
