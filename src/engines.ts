export type Field = {
  key: string;
  label: string;
  kind: "text" | "textarea";
  placeholder?: string;
  required?: boolean;
  rows?: number;
  half?: boolean; // ô ngắn, xếp 2 cột
  optional?: boolean; // nằm trong nhóm "Thêm chi tiết" (thu gọn)
};

/** Form 5W1H duy nhất — nhập 1 lần, tạo mọi loại nội dung */
export const FORM_FIELDS: Field[] = [
  {
    key: "who",
    label: "Ai — doanh nghiệp / tổ chức / nhân vật chính",
    kind: "text",
    required: true,
    placeholder: "VD: Tập đoàn Vingroup",
  },
  {
    key: "what",
    label: "Cái gì — sự kiện / nội dung chính",
    kind: "textarea",
    rows: 2,
    required: true,
    placeholder: "VD: Công bố đầu tư 12,75 triệu USD vào công ty robot tại Mỹ",
  },
  { key: "when", label: "Khi nào", kind: "text", placeholder: "VD: 19/7/2026", half: true },
  { key: "where", label: "Ở đâu", kind: "text", placeholder: "VD: Hà Nội", half: true },
  {
    key: "why",
    label: "Vì sao — lý do / mục tiêu",
    kind: "textarea",
    rows: 2,
    placeholder: "VD: mở rộng mảng công nghiệp - công nghệ, tiếp cận nhân lực AI tại Mỹ",
  },
  {
    key: "how",
    label: "Như thế nào — diễn biến, cách thực hiện",
    kind: "textarea",
    rows: 3,
    placeholder: "Chi tiết cách triển khai, các bước, đơn vị tham gia...",
  },
  {
    key: "numbers",
    label: "Số liệu nổi bật",
    kind: "textarea",
    rows: 3,
    optional: true,
    placeholder: "Mỗi dòng một số liệu: vốn đầu tư, doanh thu, số lượng, tăng trưởng %...",
  },
  {
    key: "context",
    label: "Bối cảnh / thông tin thêm",
    kind: "textarea",
    rows: 3,
    optional: true,
    placeholder: "Lịch sử liên quan, thị trường, đối thủ, kế hoạch tương lai...",
  },
  {
    key: "quote",
    label: "Phát biểu lãnh đạo (nếu có)",
    kind: "textarea",
    rows: 2,
    optional: true,
    placeholder: "Họ tên, chức danh + nội dung phát biểu. Để trống nếu chưa có.",
  },
  {
    key: "boilerplate",
    label: "Giới thiệu doanh nghiệp (boilerplate)",
    kind: "textarea",
    rows: 2,
    optional: true,
    placeholder: "Đoạn giới thiệu chuẩn về doanh nghiệp (dùng cho thông cáo báo chí)",
  },
];

export const MAIN_FIELDS = FORM_FIELDS.filter((f) => !f.optional);
export const MORE_FIELDS = FORM_FIELDS.filter((f) => f.optional);

export type OutputDef = { id: "press_release" | "article" | "facebook"; label: string };

export const OUTPUTS: OutputDef[] = [
  { id: "press_release", label: "Thông cáo báo chí" },
  { id: "article", label: "Bài VnExpress" },
  { id: "facebook", label: "Post Facebook" },
];

const FIELD_LABELS: Record<string, string> = {
  who: "Ai (chủ thể)",
  what: "Sự kiện / nội dung chính",
  when: "Thời gian",
  where: "Địa điểm",
  why: "Lý do / mục tiêu",
  how: "Diễn biến / cách thực hiện",
  numbers: "Số liệu",
  context: "Bối cảnh / thông tin thêm",
  quote: "Phát biểu lãnh đạo",
  boilerplate: "Giới thiệu doanh nghiệp",
};

/** Ghép form 5W1H thành brief gửi cho model */
export function buildBrief(values: Record<string, string>): string {
  const parts: string[] = [];
  for (const f of FORM_FIELDS) {
    const v = (values[f.key] || "").trim();
    if (!v) continue;
    parts.push(`## ${FIELD_LABELS[f.key] || f.label}\n${v}`);
  }
  return parts.join("\n\n");
}

export function missingRequired(values: Record<string, string>): string | null {
  for (const f of FORM_FIELDS) {
    if (f.required && !(values[f.key] || "").trim()) return f.label;
  }
  return null;
}
