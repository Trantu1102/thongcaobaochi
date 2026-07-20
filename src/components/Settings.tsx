import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import {
  MODELS,
  PROVIDERS,
  Provider,
  embeddedProvider,
  getCustomModel,
  getProvider,
  hasApiKey,
  saveCustomModel,
  saveModel,
  saveProvider,
  setApiKey,
} from "../api";

export default function Settings() {
  const [provider, setProvider] = useState<Provider>(getProvider());
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [keyStatus, setKeyStatus] = useState<boolean | null>(null);
  const [model, setModel] = useState(
    () => localStorage.getItem(`autowrite_model_${getProvider()}`) || MODELS[getProvider()][0].id,
  );
  const [customModel, setCustomModel] = useState(getCustomModel(getProvider()));
  const [embedded, setEmbedded] = useState<string | null>(null);
  const [version, setVersion] = useState("");

  const providerInfo = PROVIDERS.find((p) => p.id === provider)!;

  useEffect(() => {
    embeddedProvider().then(setEmbedded);
    getVersion().then(setVersion).catch(() => {});
  }, []);

  useEffect(() => {
    hasApiKey(provider).then(setKeyStatus);
    setModel(localStorage.getItem(`autowrite_model_${provider}`) || MODELS[provider][0].id);
    setCustomModel(getCustomModel(provider));
    setKey("");
  }, [provider]);

  function changeProvider(p: Provider) {
    setProvider(p);
    saveProvider(p);
  }

  async function save() {
    await setApiKey(provider, key);
    setKey("");
    setSaved(true);
    setKeyStatus(await hasApiKey(provider));
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="settings">
      <h2>
        Cài đặt {version && <span className="version-tag">Autowrite v{version}</span>}
      </h2>

      <section>
        <h3>Nhà cung cấp API</h3>
        <p className="hint">
          Anthropic: gọi trực tiếp, có prompt caching (rẻ hơn khi dùng nhiều). OpenRouter: dùng key
          sk-or-..., cộng thêm phí ~5%.
        </p>
        <select value={provider} onChange={(e) => changeProvider(e.target.value as Provider)}>
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </section>

      <section>
        <h3>API key — {providerInfo.label}</h3>
        <p className="hint">
          Key được lưu an toàn trong Keychain của macOS, không lưu vào file. Lấy key tại{" "}
          <a href={providerInfo.keyUrl} target="_blank" rel="noreferrer">
            {providerInfo.keyUrl.replace("https://", "")}
          </a>
          .
        </p>
        <div className="row">
          <input
            type="password"
            placeholder={providerInfo.keyPlaceholder}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button className="primary" onClick={save} disabled={!key.trim()}>
            Lưu key
          </button>
        </div>
        <div className="key-status">
          {saved
            ? "Đã lưu ✓"
            : keyStatus === null
              ? ""
              : keyStatus
                ? `Trạng thái: đã có key ${providerInfo.label} ✓`
                : `Trạng thái: chưa có key ${providerInfo.label} — cần nhập trước khi tạo nội dung`}
        </div>
        {embedded === provider && (
          <div className="key-status" style={{ color: "var(--accent)" }}>
            App này đã được build kèm sẵn một key {providerInfo.label} (mã hóa). Bạn có thể dùng
            ngay mà không cần nhập; nếu nhập key riêng ở trên, key riêng sẽ được ưu tiên.
          </div>
        )}
      </section>

      <section>
        <h3>Model</h3>
        <select
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            saveModel(provider, e.target.value);
          }}
        >
          {MODELS[provider].map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        {provider === "openrouter" && (
          <>
            <p className="hint" style={{ marginTop: 10 }}>
              Model tùy chỉnh (slug OpenRouter, để trống nếu dùng lựa chọn trên):
            </p>
            <input
              type="text"
              placeholder="VD: anthropic/claude-opus-4.8-fast"
              value={customModel}
              onChange={(e) => {
                setCustomModel(e.target.value);
                saveCustomModel(provider, e.target.value);
              }}
              style={{ width: "100%" }}
            />
          </>
        )}
      </section>
    </div>
  );
}
