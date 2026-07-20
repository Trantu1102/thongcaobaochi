import { useEffect, useState } from "react";
import "./App.css";
import { Provider, embeddedProvider, getProvider, saveProvider } from "./api";
import Composer from "./components/Composer";
import History from "./components/History";
import Settings from "./components/Settings";

type Tab = "compose" | "history" | "settings";

export default function App() {
  const [tab, setTab] = useState<Tab>("compose");

  // Nếu app được build kèm key nhúng và người dùng chưa chọn provider,
  // tự chọn đúng provider của key nhúng để dùng được ngay.
  useEffect(() => {
    if (localStorage.getItem("autowrite_provider")) return;
    embeddedProvider().then((p) => {
      if (p && (p === "anthropic" || p === "openrouter") && getProvider() !== p) {
        saveProvider(p as Provider);
      }
    });
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Autowrite <span className="brand-sub">trợ lý viết nội dung</span>
        </div>
        <nav className="tabs">
          <button className={tab === "compose" ? "tab active" : "tab"} onClick={() => setTab("compose")}>
            Tạo nội dung
          </button>
          <button className={tab === "history" ? "tab active" : "tab"} onClick={() => setTab("history")}>
            Lịch sử
          </button>
          <button className={tab === "settings" ? "tab active" : "tab"} onClick={() => setTab("settings")}>
            Cài đặt
          </button>
        </nav>
      </header>

      <main className="content">
        <div style={{ display: tab === "compose" ? "contents" : "none" }}>
          <Composer />
        </div>
        {tab === "history" && <History />}
        {tab === "settings" && <Settings />}
      </main>
    </div>
  );
}
