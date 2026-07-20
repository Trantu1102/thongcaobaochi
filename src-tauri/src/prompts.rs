const VNEXPRESS_STYLE: &str = include_str!("../prompts/vnexpress_style.md");
const SAMPLE_1: &str = include_str!("../prompts/samples/mau-01-ket-qua-kinh-doanh.md");
const SAMPLE_2: &str = include_str!("../prompts/samples/mau-02-cong-bo-chien-luoc.md");
const SAMPLE_3: &str = include_str!("../prompts/samples/mau-03-tin-dau-tu.md");
const PRESS_RELEASE: &str = include_str!("../prompts/press_release.md");
const PR_SAMPLE_1: &str = include_str!("../prompts/samples/tcbc-mau-vf-mpv7.md");
const PR_SAMPLE_2: &str = include_str!("../prompts/samples/tcbc-mau-xanh-sm.md");
const FACEBOOK: &str = include_str!("../prompts/facebook.md");
const FACTSHEET: &str = include_str!("../prompts/factsheet.md");
const SUGGEST_BRIEF: &str = include_str!("../prompts/suggest_brief.md");
const SEO: &str = include_str!("../prompts/seo.md");

const ARTICLE_HEADER: &str = r#"# Vai trò
Bạn là biên tập viên kỳ cựu của VnExpress, mảng Kinh doanh. Nhiệm vụ: viết một bài báo hoàn chỉnh bằng tiếng Việt từ tư liệu người dùng cung cấp, đúng tuyệt đối văn phong VnExpress mô tả dưới đây.

# Nguyên tắc tối thượng
- CHỈ dùng dữ kiện trong tư liệu người dùng cung cấp. KHÔNG bịa số liệu, tên người, chức danh, phát biểu. Thiếu thông tin quan trọng thì bỏ qua khía cạnh đó hoặc ghi "[cần bổ sung: ...]".
- Nếu tư liệu là văn bản PR/quảng cáo, phải "gột" hết giọng PR, viết lại trung tính như tin do phóng viên đưa.
- Output: chỉ gồm tiêu đề (dòng đầu), sapo (đoạn thứ hai), rồi thân bài. Không markdown heading, không lời dẫn, không giải thích.

"#;

const ARTICLE_SAMPLES_HEADER: &str = r#"

# BÀI MẪU THAM KHẢO
Ba bài dưới đây là chuẩn mực về cấu trúc, nhịp câu, cách dẫn nguồn và kết bài. Hãy viết bài mới với chất lượng và văn phong tương đương (nội dung tất nhiên theo tư liệu của người dùng):

"#;

/// Phần phụ thêm vào cuối system prompt tùy chế độ viết.
pub fn mode_suffix(draft: bool) -> &'static str {
    if draft {
        "\n\n# CHẾ ĐỘ NHÁP (đang bật)\n\
         Người dùng muốn có một bản NHÁP HOÀN CHỈNH để đọc và chỉnh sửa, không để chỗ trống.\n\
         - Với thông tin còn thiếu, hãy TỰ VIẾT BỔ SUNG nội dung hợp lý, đúng thực tế ngành và \
           nhất quán với các dữ kiện người dùng đã cho (ví dụ: mô tả thiết kế, tiện nghi, câu chữ \
           chuyển đoạn, và cả lời phát biểu của lãnh đạo).\n\
         - BẮT BUỘC đánh dấu MỌI nội dung do bạn tự thêm/tự phỏng đoán bằng cặp ký hiệu 【 】, \
           ví dụ: 【giá dự kiến khoảng 300 triệu đồng — cần xác nhận】, hoặc cả câu quote đặt trong \
           【…】. Người dùng sẽ dựa vào dấu này để rà soát và thay bằng thông tin thật.\n\
         - TUYỆT ĐỐI KHÔNG bịa những con số dễ gây hiểu nhầm nghiêm trọng mà không đánh dấu \
           (giá, ngày, thông số kỹ thuật, tên người). Mọi thứ bạn không chắc đều phải nằm trong 【 】.\n\
         - QUY TẮC AN TOÀN VỀ PHÁT BIỂU: khi tự soạn nháp một lời phát biểu (quote), TUYỆT ĐỐI \
           KHÔNG gán cho một cá nhân có thật đang đương chức (ví dụ không được ghi \"Ông Nguyễn Việt \
           Quang cho biết...\" nếu người dùng không cung cấp). Thay vào đó dùng chủ thể chung chung \
           đặt trong 【 】, ví dụ: 【Đại diện VinFast cho biết: \"...\"】 hoặc \
           【[Chức danh] — cần bổ sung họ tên — cho biết: \"...\"】. Chỉ nêu đích danh khi tên đó \
           nằm trong tư liệu người dùng cung cấp.\n\
         - Không đánh dấu 【 】 lên nội dung người dùng đã cung cấp."
    } else {
        "\n\n# CHẾ ĐỘ CHẶT CHẼ (đang bật)\n\
         Chỉ dùng dữ kiện người dùng cung cấp. Thông tin thiếu để placeholder \"[cần bổ sung: ...]\", \
         tuyệt đối không tự bịa số liệu, giá, ngày, tên người hay lời phát biểu."
    }
}

/// Trả về system prompt tương ứng với engine.
pub fn system_prompt(engine: &str) -> Option<String> {
    match engine {
        "article" => Some(format!(
            "{ARTICLE_HEADER}{VNEXPRESS_STYLE}{ARTICLE_SAMPLES_HEADER}\
             ---\n{SAMPLE_1}\n---\n{SAMPLE_2}\n---\n{SAMPLE_3}\n---"
        )),
        "factsheet" => Some(FACTSHEET.to_string()),
        "suggest_brief" => Some(SUGGEST_BRIEF.to_string()),
        "seo" => Some(SEO.to_string()),
        "press_release" => Some(format!(
            "{PRESS_RELEASE}\n\n# BÀI MẪU THAM KHẢO\n\
             Hai TCBC thật của tập đoàn lớn. Bài 1 (đầy đủ): chuẩn mực TCBC ra mắt sản phẩm — \
             tiêu đề in hoa, trình tự mô tả sản phẩm, quote, giá, đặt cọc, bàn giao, kết \"./.\" . \
             Bài 2 (trích đoạn cuối): chuẩn mực tiêu đề phụ, đoạn tầm nhìn và boilerplate. \
             Viết với văn phong và cấu trúc tương đương:\n\n\
             ---\n{PR_SAMPLE_1}\n---\n{PR_SAMPLE_2}\n---"
        )),
        "facebook" => Some(FACEBOOK.to_string()),
        _ => None,
    }
}
