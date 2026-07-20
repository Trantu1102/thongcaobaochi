import { ReactNode, useEffect, useRef, useState } from "react";
import { generate, suggestBrief } from "../api";
import { Field, FORM_FIELDS, MAIN_FIELDS, MORE_FIELDS, buildBrief, missingRequired } from "../engines";
import { fixVN, mdToHtml, stripMd } from "../lib/md";
import RichEditor from "./RichEditor";

type Status = "idle" | "streaming" | "done" | "error";

/** Render read-only: tô sáng 【…】 và in đậm **…** */
function renderRich(raw: string) {
  const text = fixVN(raw);
  const tokens = text.split(/(【[^】]*】|\*\*[^*]+\*\*)/g);
  return tokens.map((t, i) => {
    if (t.startsWith("【") && t.endsWith("】"))
      return (
        <mark key={i} className="draft-mark">
          {t.slice(1, -1)}
        </mark>
      );
    if (t.startsWith("**") && t.endsWith("**")) return <strong key={i}>{t.slice(2, -2)}</strong>;
    return t;
  });
}

/** Copy có định dạng (Word/email giữ được đậm) + text thuần dự phòng */
async function copyRich(md: string) {
  const html = mdToHtml(md);
  const plain = stripMd(md);
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
  } catch {
    await navigator.clipboard.writeText(plain);
  }
}

type TabId = "pr" | "article" | "facebook" | "seo";

export default function Composer() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState(true);

  // Gợi ý nhanh — phác thảo bộ tư liệu từ một câu ngắn
  const [hint, setHint] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // Bước 1 — thông cáo báo chí (có thể sửa trực tiếp)
  const [prText, setPrText] = useState("");
  const [prStatus, setPrStatus] = useState<Status>("idle");
  const [prError, setPrError] = useState<string | null>(null);

  // Bước 2 — bài phái sinh
  const [results, setResults] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // SEO cho bài báo
  const [seoText, setSeoText] = useState("");
  const [seoStatus, setSeoStatus] = useState<Status>("idle");
  const [seoError, setSeoError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabId>("pr");

  const [formError, setFormError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const outRef = useRef<HTMLDivElement>(null);

  function updateScrollHint() {
    const el = outRef.current;
    if (!el) return;
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 40);
  }
  // cập nhật lại khi nội dung thay đổi (stream, tạo mục mới)
  useEffect(() => {
    const id = requestAnimationFrame(updateScrollHint);
    return () => cancelAnimationFrame(id);
  }, [prText, results, statuses, prStatus, seoText, seoStatus, tab]);

  function scrollDown() {
    const el = outRef.current;
    if (el) el.scrollBy({ top: el.clientHeight * 0.85, behavior: "smooth" });
  }

  function onChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const editField = editKey ? FORM_FIELDS.find((f) => f.key === editKey) ?? null : null;

  // Đóng modal bằng phím Esc
  useEffect(() => {
    if (!editKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editKey]);

  function fieldEl(f: Field) {
    const val = fixVN(values[f.key] || "");
    return (
      <div key={f.key} className={"field" + (f.half ? " field-half" : "")}>
        <span>
          {f.label}
          {f.required && <em className="req"> *</em>}
        </span>
        <button
          type="button"
          className={"field-open" + (val ? " has-value" : "")}
          onClick={() => setEditKey(f.key)}
          title="Bấm để mở khung soạn lớn"
        >
          {val ? val : <span className="field-ph">{f.placeholder || "Bấm để nhập…"}</span>}
        </button>
      </div>
    );
  }

  // Gộp các ô "half" liên tiếp thành 1 hàng 2 cột
  function renderFields(list: Field[]) {
    const rows: ReactNode[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const next = list[i + 1];
      if (f.half && next?.half) {
        rows.push(
          <div className="field-row" key={f.key}>
            {fieldEl(f)}
            {fieldEl(next)}
          </div>,
        );
        i++;
      } else {
        rows.push(fieldEl(f));
      }
    }
    return rows;
  }

  const filledMore = MORE_FIELDS.filter((f) => (values[f.key] || "").trim()).length;

  async function runSuggest() {
    if (!hint.trim()) {
      setSuggestError("Nhập một ý ngắn để app phác thảo tư liệu.");
      return;
    }
    setSuggestError(null);
    setSuggesting(true);
    try {
      const filled = await suggestBrief(hint.trim());
      // Chỉ nhận các khóa app dùng, giữ nguyên ô người dùng đã tự nhập nếu gợi ý để trống
      setValues((prev) => {
        const next = { ...prev };
        for (const f of FORM_FIELDS) {
          const v = (filled[f.key] || "").trim();
          if (v) next[f.key] = v;
        }
        return next;
      });
      // mở phần chi tiết nếu gợi ý có điền vào đó
      if (MORE_FIELDS.some((f) => (filled[f.key] || "").trim())) setShowMore(true);
    } catch (err) {
      setSuggestError(String(err instanceof Error ? err.message : err));
    }
    setSuggesting(false);
  }

  // BƯỚC 1: tạo thông cáo báo chí
  async function runPress() {
    const missing = missingRequired(values);
    if (missing) {
      setFormError(`Vui lòng điền: ${missing}`);
      return;
    }
    setFormError(null);
    setBusy(true);
    setPrText("");
    setPrError(null);
    setPrStatus("streaming");
    setTab("pr");
    // reset bài phái sinh cũ
    setResults({});
    setStatuses({});
    setErrors({});
    setSeoText("");
    setSeoStatus("idle");
    try {
      await generate("press_release", buildBrief(values), draft, (e) => {
        if (e.type === "delta") {
          setPrText((prev) => fixVN(prev + e.text));
          outRef.current?.scrollTo({ top: 0 });
        } else if (e.type === "error") {
          setPrError(e.message);
        }
      });
      setPrStatus("done");
    } catch (err) {
      setPrError(String(err));
      setPrStatus("error");
    }
    setBusy(false);
  }

  // Tạo một loại nội dung phái sinh (bài báo hoặc post) từ thông cáo đã chốt
  async function runOne(id: "article" | "facebook") {
    if (!prText.trim() || busy) return;
    setBusy(true);
    setResults((prev) => ({ ...prev, [id]: "" }));
    setErrors((prev) => ({ ...prev, [id]: "" }));
    setStatuses((prev) => ({ ...prev, [id]: "streaming" }));
    setTab(id);

    const brief =
      "Dưới đây là bản thông cáo báo chí đã chốt. Hãy dùng làm tư liệu nguồn, " +
      "giữ nguyên mọi số liệu và dữ kiện trong đó:\n\n" +
      prText.trim();
    try {
      await generate(id, brief, draft, (e) => {
        if (e.type === "delta") {
          setResults((prev) => ({ ...prev, [id]: fixVN((prev[id] || "") + e.text) }));
          outRef.current?.scrollTo({ top: outRef.current.scrollHeight });
        } else if (e.type === "error") {
          setErrors((prev) => ({ ...prev, [id]: e.message }));
        }
      });
      setStatuses((prev) => ({ ...prev, [id]: "done" }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, [id]: String(err) }));
      setStatuses((prev) => ({ ...prev, [id]: "error" }));
    }
    setBusy(false);
  }

  // Bấm tab: chuyển tab; nếu tab bật mà chưa có nội dung thì tạo luôn
  function openTab(id: TabId) {
    if (id === "pr") return setTab("pr");
    if (id === "article" || id === "facebook") {
      if (prStatus !== "done") return; // chưa có thông cáo -> mờ, không bấm được
      setTab(id);
      if (!results[id] && statuses[id] !== "streaming") runOne(id);
      return;
    }
    if (id === "seo") {
      if (!(results.article || "").trim()) return; // cần có bài báo trước
      setTab("seo");
      if (!seoText && seoStatus !== "streaming") runSeo();
    }
  }

  // Tạo SEO chuẩn Google từ bài báo
  async function runSeo() {
    const article = (results.article || "").trim();
    if (!article) return;
    setBusy(true);
    setSeoText("");
    setSeoError(null);
    setSeoStatus("streaming");
    setTab("seo");
    try {
      await generate("seo", article, false, (e) => {
        if (e.type === "delta") setSeoText((prev) => fixVN(prev + e.text));
        else if (e.type === "error") setSeoError(e.message);
      });
      setSeoStatus("done");
    } catch (err) {
      setSeoError(String(err));
      setSeoStatus("error");
    }
    setBusy(false);
  }

  async function copy(id: string, text: string) {
    await copyRich(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  // Menu 4 tab cố định; trạng thái bật/tắt tùy tiến độ
  const TABS: { id: TabId; label: string }[] = [
    { id: "pr", label: "Thông cáo báo chí" },
    { id: "article", label: "Bài báo chí" },
    { id: "facebook", label: "Post Facebook" },
    { id: "seo", label: "SEO" },
  ];
  function tabState(id: TabId) {
    if (id === "pr") return { enabled: true, generating: prStatus === "streaming", generated: prStatus !== "idle" };
    if (id === "article" || id === "facebook")
      return {
        enabled: prStatus === "done",
        generating: statuses[id] === "streaming",
        generated: !!(results[id] || "").trim(),
      };
    return {
      enabled: !!(results.article || "").trim(),
      generating: seoStatus === "streaming",
      generated: seoStatus !== "idle",
    };
  }
  const activeTab: TabId = tab;

  return (
    <div className="panel">
      <div className="form-col">
        <div className="form-head">
          <span className="form-head-title">Tạo nội dung</span>
          <span className="info-icon" tabIndex={0} aria-label="Hướng dẫn">
            i
            <span className="info-tip">
              <strong>Bước 1:</strong> nhập thông tin 5W1H → tạo thông cáo báo chí.
              <br />
              <strong>Bước 2:</strong> chỉnh sửa, chốt nội dung → tạo bài VnExpress và post Facebook
              từ thông cáo đã chốt (số liệu tự khớp vì cùng nguồn).
            </span>
          </span>
        </div>

        <div className="suggest-box">
          <span className="suggest-label">✨ Gợi ý nhanh</span>
          <p className="hint" style={{ margin: "0 0 8px" }}>
            Chỉ cần một ý ngắn, app phác thảo sẵn cả form để bạn chỉnh (chỗ tự đoán đánh dấu 【…】).
          </p>
          <textarea
            rows={2}
            placeholder="VD: Vingroup ra mắt xe điện mini VF 2 tại Hà Nội — hoặc — chương trình hiến giác mạc của Bệnh viện Mắt Trung ương"
            value={hint}
            onChange={(e) => setHint(e.target.value)}
          />
          <button onClick={runSuggest} disabled={suggesting || busy}>
            {suggesting ? "Đang phác thảo…" : "Điền gợi ý vào form"}
          </button>
          {suggestError && <div className="error">{suggestError}</div>}
        </div>

        {renderFields(MAIN_FIELDS)}

        <button
          type="button"
          className="more-toggle"
          onClick={() => setShowMore((s) => !s)}
          aria-expanded={showMore}
        >
          {showMore ? "▾" : "▸"} Thêm chi tiết — số liệu, bối cảnh, quote, giới thiệu
          {!showMore && filledMore > 0 ? ` (${filledMore} đã điền)` : ""}
        </button>
        {showMore && <div className="more-fields">{renderFields(MORE_FIELDS)}</div>}

        <div className="field">
          <span>Chế độ viết</span>
          <div className="checks">
            <label className="check">
              <input type="radio" checked={draft} onChange={() => setDraft(true)} />
              <span>
                <strong>Nháp hoàn chỉnh</strong> — tự viết bù phần thiếu, đánh dấu 【…】 chỗ cần
                kiểm để bạn sửa
              </span>
            </label>
            <label className="check">
              <input type="radio" checked={!draft} onChange={() => setDraft(false)} />
              <span>
                <strong>Chặt chẽ</strong> — chỉ dùng thông tin bạn nhập, thiếu thì để [cần bổ sung]
              </span>
            </label>
          </div>
        </div>

        <div className="form-footer">
          {formError && <div className="error">{formError}</div>}
          <button className="primary" onClick={runPress} disabled={busy}>
            {busy && prStatus === "streaming" ? "Đang viết thông cáo…" : "① Tạo thông cáo báo chí"}
          </button>
        </div>
      </div>

      <div className="output-col">
        <div className="result-tabs">
          {TABS.map((t) => {
            const st = tabState(t.id);
            const ready = st.enabled && !st.generated && !st.generating && t.id !== "pr";
            const cls =
              "result-tab" +
              (activeTab === t.id ? " active" : "") +
              (!st.enabled ? " disabled" : "") +
              (ready ? " ready" : "");
            return (
              <button key={t.id} className={cls} disabled={!st.enabled} onClick={() => openTab(t.id)}>
                {t.label}
                {st.generating && <span className="tab-dot" />}
                {ready && <span className="tab-plus">＋</span>}
              </button>
            );
          })}
        </div>

        <div className="output-body" ref={outRef} onScroll={updateScrollHint}>
          {prStatus === "idle" && (
            <div className="output-empty">
              Điền form bên trái rồi bấm "Tạo thông cáo báo chí". Kết quả hiện ở đây, chữ chạy
              realtime — bạn có thể sửa trực tiếp trước khi tạo bài báo và post.
            </div>
          )}

          {/* TAB: Thông cáo báo chí */}
          {activeTab === "pr" && prStatus !== "idle" && (
            <section className="out-section">
              <div className="out-section-header">
                <span className="badge badge-press_release">Thông cáo báo chí</span>
                <span className="out-status">
                  {prStatus === "streaming" && "đang viết…"}
                  {prStatus === "done" && "sửa trực tiếp → bấm tab Bài báo chí / Post Facebook để tạo tiếp"}
                  {prStatus === "error" && "lỗi"}
                </span>
                {prText && (
                  <button className="copy-btn" onClick={() => copy("pr", prText)}>
                    {copiedId === "pr" ? "Đã copy ✓" : "⧉ Copy mục này"}
                  </button>
                )}
              </div>
              {prError && <div className="error">{prError}</div>}
              <RichEditor
                markdown={prText}
                onChange={setPrText}
                placeholder="Thông cáo báo chí sẽ hiện ở đây…"
              />
            </section>
          )}

          {/* TAB: Bài báo chí + nút SEO */}
          {activeTab === "article" && (
            <section className="out-section">
              <div className="out-section-header">
                <span className="badge badge-article">Bài báo chí</span>
                <span className="out-status">
                  {statuses.article === "streaming" && "đang viết…"}
                  {statuses.article === "done" && "xong ✓"}
                  {statuses.article === "error" && "lỗi"}
                </span>
                {results.article && (
                  <>
                    <button className="mini-btn" onClick={() => runOne("article")} disabled={busy} title="Tạo lại">
                      ↻ Tạo lại
                    </button>
                    <button className="seo-btn" onClick={runSeo} disabled={busy}>
                      {seoStatus === "streaming" ? "Đang tạo SEO…" : "🔍 Tạo SEO Google"}
                    </button>
                    <button className="copy-btn" onClick={() => copy("article", results.article)}>
                      {copiedId === "article" ? "Đã copy ✓" : "⧉ Copy mục này"}
                    </button>
                  </>
                )}
              </div>
              {errors.article && <div className="error">{errors.article}</div>}
              {results.article && <pre>{renderRich(results.article)}</pre>}
            </section>
          )}

          {/* TAB: Post Facebook */}
          {activeTab === "facebook" && (
            <section className="out-section">
              <div className="out-section-header">
                <span className="badge badge-facebook">Post Facebook</span>
                <span className="out-status">
                  {statuses.facebook === "streaming" && "đang viết…"}
                  {statuses.facebook === "done" && "xong ✓"}
                  {statuses.facebook === "error" && "lỗi"}
                </span>
                {results.facebook && (
                  <>
                    <button className="mini-btn" onClick={() => runOne("facebook")} disabled={busy} title="Tạo lại">
                      ↻ Tạo lại
                    </button>
                    <button className="copy-btn" onClick={() => copy("facebook", results.facebook)}>
                      {copiedId === "facebook" ? "Đã copy ✓" : "⧉ Copy mục này"}
                    </button>
                  </>
                )}
              </div>
              {errors.facebook && <div className="error">{errors.facebook}</div>}
              {results.facebook && <pre>{renderRich(results.facebook)}</pre>}
            </section>
          )}

          {/* TAB: SEO */}
          {activeTab === "seo" && (
            <section className="out-section">
              <div className="out-section-header">
                <span className="badge badge-seo">SEO Google</span>
                <span className="out-status">
                  {seoStatus === "streaming" && "đang tạo…"}
                  {seoStatus === "done" && "xong ✓"}
                  {seoStatus === "error" && "lỗi"}
                </span>
                {seoText && (
                  <>
                    <button className="mini-btn" onClick={runSeo} disabled={busy} title="Tạo lại">
                      ↻ Tạo lại
                    </button>
                    <button className="copy-btn" onClick={() => copy("seo", seoText)}>
                      {copiedId === "seo" ? "Đã copy ✓" : "⧉ Copy mục này"}
                    </button>
                  </>
                )}
              </div>
              {seoError && <div className="error">{seoError}</div>}
              {seoText && <pre>{renderRich(seoText)}</pre>}
            </section>
          )}
        </div>
        {canScrollDown && (
          <button className="scroll-hint" onClick={scrollDown} title="Cuộn xuống xem tiếp" aria-label="Cuộn xuống xem tiếp">
            <span className="scroll-hint-text">Xem tiếp</span> ⌄
          </button>
        )}
      </div>

      {editField && (
        <div className="modal-backdrop" onClick={() => setEditKey(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span>
                {editField.label}
                {editField.required && <em className="req"> *</em>}
              </span>
              <button className="modal-close" onClick={() => setEditKey(null)} title="Đóng (Esc)">
                ✕
              </button>
            </div>
            {editField.placeholder && <p className="hint modal-hint">{editField.placeholder}</p>}
            <textarea
              className="modal-editor"
              autoFocus
              value={fixVN(values[editField.key] || "")}
              onChange={(e) => onChange(editField.key, e.target.value)}
            />
            <div className="modal-footer">
              <button onClick={() => onChange(editField.key, "")}>Xóa nội dung</button>
              <button className="primary" onClick={() => setEditKey(null)}>
                Xong
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
