use std::sync::Mutex;

use rusqlite::Connection;
use serde::Serialize;
use tauri::{ipc::Channel, State};

use crate::{claude, db, embedded, prompts};

pub struct AppState {
    pub db: Mutex<Connection>,
}

#[derive(Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamEvent {
    Delta { text: String },
    Done { doc_id: i64 },
    Error { message: String },
}

const SERVICE: &str = "com.mac.autowrite";

fn account_for(provider: &str) -> &'static str {
    match provider {
        "openrouter" => "openrouter_api_key",
        _ => "anthropic_api_key",
    }
}

fn provider_label(provider: &str) -> &'static str {
    match provider {
        "openrouter" => "OpenRouter",
        _ => "Anthropic",
    }
}

fn read_api_key(provider: &str) -> Result<String, String> {
    // Ưu tiên key người dùng tự lưu trong Keychain (cho phép ghi đè key nhúng).
    if let Ok(k) = keyring::Entry::new(SERVICE, account_for(provider)).and_then(|e| e.get_password())
    {
        return Ok(k);
    }
    // Nếu không có, dùng key nhúng sẵn trong app (nếu build kèm) và đúng provider.
    if let Some((emb_provider, emb_key)) = embedded::embedded_key() {
        if emb_provider == provider {
            return Ok(emb_key);
        }
    }
    Err(format!(
        "Chưa có API key cho {}. Vào tab Cài đặt để nhập key.",
        provider_label(provider)
    ))
}

#[tauri::command]
pub fn set_api_key(provider: String, key: String) -> Result<(), String> {
    let entry =
        keyring::Entry::new(SERVICE, account_for(&provider)).map_err(|e| e.to_string())?;
    if key.trim().is_empty() {
        let _ = entry.delete_credential();
        return Ok(());
    }
    entry.set_password(key.trim()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn has_api_key(provider: String) -> bool {
    read_api_key(&provider).is_ok()
}

/// Provider mà app được build kèm key nhúng (để frontend tự chọn đúng nhà cung cấp).
#[tauri::command]
pub fn embedded_provider() -> Option<String> {
    embedded::embedded_provider()
}

#[tauri::command]
pub async fn generate(
    engine: String,
    brief: String,
    model: Option<String>,
    provider: Option<String>,
    draft: Option<bool>,
    today: Option<String>,
    state: State<'_, AppState>,
    on_event: Channel<StreamEvent>,
) -> Result<(), String> {
    let provider = provider.unwrap_or_else(|| "anthropic".to_string());
    let api_key = read_api_key(&provider)?;
    let model = model
        .filter(|m| !m.trim().is_empty())
        .unwrap_or_else(|| match provider.as_str() {
            "openrouter" => "anthropic/claude-opus-4.8".to_string(),
            _ => "claude-opus-4-8".to_string(),
        });
    let base = prompts::system_prompt(&engine)
        .ok_or_else(|| format!("Engine không hợp lệ: {engine}"))?;
    // Chỉ nối chỉ dẫn chế độ viết cho các engine sinh bài thật.
    let mut system = if matches!(engine.as_str(), "press_release" | "article" | "facebook") {
        format!("{base}{}", prompts::mode_suffix(draft.unwrap_or(false)))
    } else {
        base
    };
    // Neo mốc thời gian theo ngày hiện tại của máy — tránh bịa năm cũ.
    if let Some(today) = today.filter(|t| !t.trim().is_empty()) {
        system.push_str(&format!(
            "\n\n# NGÀY HIỆN TẠI\nHôm nay là {today}. Mọi mốc thời gian, ngày tháng và năm trong \
             nội dung phải căn theo năm hiện tại trở đi. TUYỆT ĐỐI không tự điền năm trong quá khứ \
             (ví dụ 2023, 2024...) khi phỏng đoán ngày tháng hay số liệu; nếu người dùng không nêu \
             ngày, dùng ngày hôm nay hoặc mốc tương lai gần. Chỉ giữ nguyên năm cũ khi người dùng \
             cung cấp rõ ràng."
        ));
    }

    // Phần phác thảo tư liệu tra cứu web để căn cứ vào thông tin thật, gần đây.
    let web = engine == "suggest_brief";

    let ch = on_event.clone();
    let result = if provider == "openrouter" {
        claude::stream_openrouter(&api_key, &model, &system, &brief, web, move |t| {
            let _ = ch.send(StreamEvent::Delta { text: t });
        })
        .await
    } else {
        claude::stream_message(&api_key, &model, &system, &brief, web, move |t| {
            let _ = ch.send(StreamEvent::Delta { text: t });
        })
        .await
    };

    match result {
        // Các bước phụ trợ (phác thảo tư liệu, factsheet, SEO) — không lưu vào lịch sử.
        Ok(content) if engine == "factsheet" || engine == "suggest_brief" || engine == "seo" => {
            let _ = on_event.send(StreamEvent::Done { doc_id: 0 });
            let _ = content;
            Ok(())
        }
        Ok(content) => {
            let title: String = content
                .lines()
                .find(|l| !l.trim().is_empty())
                .unwrap_or("(không có tiêu đề)")
                .trim_start_matches('#')
                .trim()
                .chars()
                .take(150)
                .collect();
            let doc_id = {
                let conn = state.db.lock().map_err(|e| e.to_string())?;
                db::insert_document(&conn, &engine, &title, &brief, &content, &model)?
            };
            let _ = on_event.send(StreamEvent::Done { doc_id });
            Ok(())
        }
        Err(message) => {
            let _ = on_event.send(StreamEvent::Error {
                message: message.clone(),
            });
            Err(message)
        }
    }
}

#[tauri::command]
pub fn list_documents(state: State<'_, AppState>) -> Result<Vec<db::Document>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::list_documents(&conn)
}

#[tauri::command]
pub fn delete_document(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    db::delete_document(&conn, id)
}
