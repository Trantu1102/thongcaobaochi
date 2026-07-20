use futures_util::StreamExt;

const API_URL: &str = "https://api.anthropic.com/v1/messages";
const OPENROUTER_URL: &str = "https://openrouter.ai/api/v1/chat/completions";

/// Gọi Claude API dạng streaming. Mỗi đoạn text nhận được sẽ gọi `on_delta`.
/// Trả về toàn bộ nội dung khi hoàn tất.
pub async fn stream_message(
    api_key: &str,
    model: &str,
    system: &str,
    user_content: &str,
    web: bool,
    on_delta: impl Fn(String),
) -> Result<String, String> {
    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": 64000,
        "stream": true,
        // system prompt dài và cố định -> cache để giảm chi phí từ request thứ 2
        "system": [{
            "type": "text",
            "text": system,
            "cache_control": { "type": "ephemeral" }
        }],
        "messages": [{ "role": "user", "content": user_content }]
    });
    // Bật web search (server-side) để lấy dữ liệu chính xác, gần đây.
    if web {
        body["tools"] = serde_json::json!([
            { "type": "web_search_20260209", "name": "web_search", "max_uses": 5 }
        ]);
    }

    let client = reqwest::Client::new();
    let resp = client
        .post(API_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Lỗi kết nối: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        let msg = serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|v| v["error"]["message"].as_str().map(String::from))
            .unwrap_or(text);
        return Err(format!("API trả về lỗi {status}: {msg}"));
    }

    let mut stream = resp.bytes_stream();
    // Buffer dạng byte: chunk có thể cắt giữa ký tự UTF-8 nhiều byte (tiếng Việt),
    // chỉ decode khi đã có trọn dòng (kết thúc bằng '\n').
    let mut buf: Vec<u8> = Vec::new();
    let mut full = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Lỗi stream: {e}"))?;
        buf.extend_from_slice(&chunk);

        while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
            let line_bytes: Vec<u8> = buf.drain(..=pos).collect();
            let line = String::from_utf8_lossy(&line_bytes);
            let line = line.trim_end();

            let Some(data) = line.strip_prefix("data: ") else {
                continue;
            };
            let Ok(v) = serde_json::from_str::<serde_json::Value>(data) else {
                continue;
            };
            match v["type"].as_str() {
                Some("content_block_delta") => {
                    if let Some(t) = v["delta"]["text"].as_str() {
                        full.push_str(t);
                        on_delta(t.to_string());
                    }
                }
                Some("message_delta") => {
                    if let Some(reason) = v["delta"]["stop_reason"].as_str() {
                        if reason == "max_tokens" {
                            return Err("Bài viết bị cắt do vượt giới hạn token".into());
                        }
                        if reason == "refusal" {
                            return Err("Model từ chối yêu cầu này".into());
                        }
                    }
                }
                Some("error") => {
                    let msg = v["error"]["message"].as_str().unwrap_or("không rõ");
                    return Err(format!("Lỗi API: {msg}"));
                }
                _ => {}
            }
        }
    }

    if full.is_empty() {
        return Err("Không nhận được nội dung từ API".into());
    }
    Ok(full)
}

/// Gọi Claude qua OpenRouter (chuẩn OpenAI chat completions, SSE).
pub async fn stream_openrouter(
    api_key: &str,
    model: &str,
    system: &str,
    user_content: &str,
    web: bool,
    on_delta: impl Fn(String),
) -> Result<String, String> {
    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": 64000,
        "stream": true,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user_content }
        ]
    });
    // Bật web search qua plugin của OpenRouter để lấy dữ liệu chính xác, gần đây.
    if web {
        body["plugins"] = serde_json::json!([{ "id": "web" }]);
    }

    let client = reqwest::Client::new();
    let resp = client
        .post(OPENROUTER_URL)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("content-type", "application/json")
        .header("HTTP-Referer", "https://github.com/autowrite")
        .header("X-Title", "Autowrite")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Lỗi kết nối OpenRouter: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        let msg = serde_json::from_str::<serde_json::Value>(&text)
            .ok()
            .and_then(|v| v["error"]["message"].as_str().map(String::from))
            .unwrap_or(text);
        return Err(format!("OpenRouter trả về lỗi {status}: {msg}"));
    }

    let mut stream = resp.bytes_stream();
    let mut buf: Vec<u8> = Vec::new();
    let mut full = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Lỗi stream: {e}"))?;
        buf.extend_from_slice(&chunk);

        while let Some(pos) = buf.iter().position(|&b| b == b'\n') {
            let line_bytes: Vec<u8> = buf.drain(..=pos).collect();
            let line = String::from_utf8_lossy(&line_bytes);
            let line = line.trim_end();

            // OpenRouter gửi comment keep-alive dạng ": OPENROUTER PROCESSING"
            if line.starts_with(':') {
                continue;
            }
            let Some(data) = line.strip_prefix("data: ") else {
                continue;
            };
            if data == "[DONE]" {
                continue;
            }
            let Ok(v) = serde_json::from_str::<serde_json::Value>(data) else {
                continue;
            };
            if let Some(err) = v.get("error") {
                let msg = err["message"].as_str().unwrap_or("không rõ");
                return Err(format!("Lỗi OpenRouter: {msg}"));
            }
            if let Some(t) = v["choices"][0]["delta"]["content"].as_str() {
                if !t.is_empty() {
                    full.push_str(t);
                    on_delta(t.to_string());
                }
            }
            if let Some(reason) = v["choices"][0]["finish_reason"].as_str() {
                if reason == "length" {
                    return Err("Bài viết bị cắt do vượt giới hạn token".into());
                }
            }
        }
    }

    if full.is_empty() {
        return Err("Không nhận được nội dung từ OpenRouter".into());
    }
    Ok(full)
}
