import { useEffect, useRef } from "react";
import { htmlToMd, mdToHtml } from "../lib/md";

type Props = {
  markdown: string;
  onChange: (md: string) => void;
  placeholder?: string;
};

/** Editor có định dạng đậm cho thông cáo báo chí.
 * - Trong lúc stream / cập nhật từ ngoài: nạp lại nội dung khi editor KHÔNG được focus
 *   (tránh nhảy con trỏ khi người dùng đang gõ).
 * - Khi người dùng gõ: chuyển HTML về markdown và báo ra ngoài. */
export default function RichEditor({ markdown, onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return; // đang gõ -> không ghi đè
    el.innerHTML = mdToHtml(markdown);
  }, [markdown]);

  function handleInput() {
    const el = ref.current;
    if (el) onChange(htmlToMd(el));
  }

  function toggleBold() {
    document.execCommand("bold");
    handleInput();
    ref.current?.focus();
  }

  return (
    <div className="rich-wrap">
      <div className="rich-toolbar">
        <button type="button" className="bold-btn" onMouseDown={(e) => e.preventDefault()} onClick={toggleBold}>
          <b>B</b> Đậm
        </button>
        <span className="rich-hint">Bôi đen chữ rồi bấm Đậm (hoặc ⌘/Ctrl+B)</span>
      </div>
      <div
        ref={ref}
        className="rich-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={handleInput}
      />
    </div>
  );
}
