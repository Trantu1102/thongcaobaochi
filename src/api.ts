import { invoke, Channel } from "@tauri-apps/api/core";

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; doc_id: number }
  | { type: "error"; message: string };

export type Document = {
  id: number;
  engine: string;
  title: string;
  brief: string;
  content: string;
  model: string;
  created_at: string;
};

export type Provider = "anthropic" | "openrouter";

export const PROVIDERS: { id: Provider; label: string; keyPlaceholder: string; keyUrl: string }[] = [
  {
    id: "anthropic",
    label: "Anthropic (gọi trực tiếp)",
    keyPlaceholder: "sk-ant-...",
    keyUrl: "https://platform.claude.com",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    keyPlaceholder: "sk-or-...",
    keyUrl: "https://openrouter.ai/keys",
  },
];

export const MODELS: Record<Provider, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-opus-4-8", label: "Claude Opus 4.8 (chất lượng cao nhất)" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5 (nhanh, rẻ hơn)" },
  ],
  openrouter: [
    { id: "anthropic/claude-opus-4.8", label: "Claude Opus 4.8 (chất lượng cao nhất)" },
    { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5 (nhanh, rẻ hơn)" },
  ],
};

export function getProvider(): Provider {
  const p = localStorage.getItem("autowrite_provider");
  return p === "openrouter" ? "openrouter" : "anthropic";
}
export function saveProvider(p: Provider) {
  localStorage.setItem("autowrite_provider", p);
}

export function getModel(provider?: Provider): string {
  const p = provider ?? getProvider();
  const custom = localStorage.getItem(`autowrite_model_custom_${p}`)?.trim();
  if (custom) return custom;
  return localStorage.getItem(`autowrite_model_${p}`) || MODELS[p][0].id;
}
export function saveModel(provider: Provider, model: string) {
  localStorage.setItem(`autowrite_model_${provider}`, model);
}
export function getCustomModel(provider: Provider): string {
  return localStorage.getItem(`autowrite_model_custom_${provider}`) || "";
}
export function saveCustomModel(provider: Provider, model: string) {
  localStorage.setItem(`autowrite_model_custom_${provider}`, model.trim());
}

function todayVN(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function generate(
  engine: string,
  brief: string,
  draft: boolean,
  onEvent: (e: StreamEvent) => void,
): Promise<void> {
  const channel = new Channel<StreamEvent>();
  channel.onmessage = onEvent;
  const provider = getProvider();
  return invoke("generate", {
    engine,
    brief,
    model: getModel(provider),
    provider,
    draft,
    today: todayVN(),
    onEvent: channel,
  });
}

/** Phác thảo bộ tư liệu từ một gợi ý ngắn. Trả về object khóa=giá trị điền vào form. */
export async function suggestBrief(hint: string): Promise<Record<string, string>> {
  let text = "";
  await generate("suggest_brief", hint, false, (e) => {
    if (e.type === "delta") text += e.text;
    else if (e.type === "error") throw new Error(e.message);
  });
  text = text.normalize("NFC");
  const s = text.indexOf("{");
  const en = text.lastIndexOf("}");
  if (s < 0 || en < 0) throw new Error("Không đọc được kết quả gợi ý. Thử lại nhé.");
  const parsed = JSON.parse(text.slice(s, en + 1)) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) out[k] = typeof v === "string" ? v : String(v ?? "");
  return out;
}

export const setApiKey = (provider: Provider, key: string) =>
  invoke<void>("set_api_key", { provider, key });
export const hasApiKey = (provider: Provider) => invoke<boolean>("has_api_key", { provider });
export const embeddedProvider = () => invoke<string | null>("embedded_provider");
export const listDocuments = () => invoke<Document[]>("list_documents");
export const deleteDocument = (id: number) => invoke<void>("delete_document", { id });
