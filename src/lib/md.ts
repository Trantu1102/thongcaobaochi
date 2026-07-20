// Chuyển đổi markdown tối giản (chỉ **đậm** + xuống dòng) sang HTML và ngược lại,
// phục vụ editor có định dạng cho thông cáo báo chí.

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** markdown -> HTML: 【x】 thành đoạn bôi vàng (bỏ dấu ngoặc), **x** thành đậm, \n thành <br> */
export function mdToHtml(md: string): string {
  const esc = escapeHtml(md.normalize("NFC"));
  // 【...】 -> <mark> bôi vàng, bỏ luôn cặp ngoặc; kèm inline style để dán ra Word vẫn giữ màu
  const marked = esc.replace(
    /【([^】]*)】/g,
    '<mark class="draft-mark" style="background:#fff3cd;color:#8a6d00">$1</mark>',
  );
  const bold = marked.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return bold.replace(/\n/g, "<br>");
}

/** HTML (từ contentEditable) -> markdown, giữ đậm bằng **, bôi vàng bằng 【】, xuống dòng bằng \n */
export function htmlToMd(root: HTMLElement): string {
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const inner = Array.from(el.childNodes).map(walk).join("");
    if (tag === "br") return "\n";
    if (tag === "mark") return inner.trim() ? `【${inner}】` : inner;
    if (tag === "b" || tag === "strong") return inner.trim() ? `**${inner}**` : inner;
    if (tag === "div" || tag === "p") return "\n" + inner;
    return inner;
  }
  let md = Array.from(root.childNodes).map(walk).join("");
  // chuẩn hóa: bỏ \n thừa ở đầu, gộp >2 dòng trống
  md = md.replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n");
  return md;
}

/** Bỏ dấu markdown để có bản text thuần (cho clipboard text/plain) */
export function stripMd(md: string): string {
  return md
    .normalize("NFC")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/【([^】]*)】/g, "$1");
}
