import { useEffect, useState } from "react";
import { Document, deleteDocument, listDocuments } from "../api";

const ENGINE_LABELS: Record<string, string> = {
  press_release: "TCBC",
  article: "Bài báo chí",
  facebook: "Facebook",
};

export default function History() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [selected, setSelected] = useState<Document | null>(null);
  const [copied, setCopied] = useState(false);

  async function reload() {
    setDocs(await listDocuments());
  }
  useEffect(() => {
    reload();
  }, []);

  async function remove(id: number) {
    await deleteDocument(id);
    if (selected?.id === id) setSelected(null);
    reload();
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="history">
      <div className="history-list">
        <h2>Lịch sử ({docs.length})</h2>
        {docs.length === 0 && <p className="hint">Chưa có nội dung nào. Bài viết sẽ tự động lưu tại đây.</p>}
        {docs.map((d) => (
          <div
            key={d.id}
            className={"history-item" + (selected?.id === d.id ? " active" : "")}
            onClick={() => setSelected(d)}
          >
            <span className={`badge badge-${d.engine}`}>{ENGINE_LABELS[d.engine] || d.engine}</span>
            <div className="history-item-main">
              <div className="history-title">{d.title}</div>
              <div className="history-meta">{d.created_at}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="history-detail">
        {selected ? (
          <>
            <div className="output-toolbar">
              <span className="output-title">{selected.title}</span>
              <div className="output-actions">
                <button onClick={() => copy(selected.content)}>{copied ? "Đã copy ✓" : "Copy"}</button>
                <button className="danger" onClick={() => remove(selected.id)}>
                  Xóa
                </button>
              </div>
            </div>
            <div className="output-body">
              <pre>{selected.content}</pre>
            </div>
          </>
        ) : (
          <div className="output-empty">Chọn một bài bên trái để xem lại.</div>
        )}
      </div>
    </div>
  );
}
