import { useMemo, useState } from "react";
import { loadProfile, saveProfile, loadHistory, saveHistory, type HistoryEntry } from "./lib/storage";
import type { Profile } from "./lib/types";
import { NewRunPage } from "./pages/NewRunPage";
import { ProfilePage } from "./pages/ProfilePage";
import { HistoryPage } from "./pages/HistoryPage";

type Tab = "new" | "history" | "profile";

export default function App() {
  const [tab, setTab] = useState<Tab>("new");

  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  const hasProfile = useMemo(() => {
    return Boolean(
      profile.initiatorName &&
        profile.senderId &&
        profile.debtorIban &&
        profile.debtorBic &&
        profile.skvBg &&
        profile.skvOcr &&
        profile.employees.azim.personnummer &&
        profile.employees.azim.clearingAccount &&
        profile.employees.aynun.personnummer &&
        profile.employees.aynun.clearingAccount
    );
  }, [profile]);

  function updateProfile(next: Profile) {
    setProfile(next);
    saveProfile(next);
  }

  function addToHistory(entry: HistoryEntry) {
    const next = [entry, ...history];
    setHistory(next);
    saveHistory(next);
  }

  function clearHistory() {
    setHistory([]);
    saveHistory([]);
  }

  return (
    <div className="container">
      <div className="tabs">
        <button className={`tab ${tab === "new" ? "active" : ""}`} onClick={() => setTab("new")}>
          New run
        </button>
        <button className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
          History
        </button>
        <button className={`tab ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>
          Profile
        </button>
      </div>

      <div style={{ display: tab === "new" ? "block" : "none" }}>
        <NewRunPage profile={profile} hasProfile={hasProfile} onGoProfile={() => setTab("profile")} onSaveHistory={addToHistory} />
      </div>

      <div style={{ display: tab === "profile" ? "block" : "none" }}>
        <ProfilePage profile={profile} onChange={updateProfile} />
      </div>

      <div style={{ display: tab === "history" ? "block" : "none" }}>
        <HistoryPage history={history} onClear={clearHistory} />
      </div>
    </div>
  );
}
