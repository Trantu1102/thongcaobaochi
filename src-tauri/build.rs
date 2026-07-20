use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::Aes256Gcm;
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use std::path::Path;

// Khóa che giấu (obfuscation) — cùng giá trị với runtime.
// Lưu ý: đây chỉ là mã hóa che giấu; key vẫn có thể bị trích xuất bởi người rành kỹ thuật.
const OBF_KEY: &[u8; 32] = b"Autowrite-embed-key-v1-32byteXX!";

fn main() {
    tauri_build::build();

    println!("cargo:rerun-if-env-changed=AUTOWRITE_EMBED_KEY");
    println!("cargo:rerun-if-env-changed=AUTOWRITE_EMBED_PROVIDER");

    let key = std::env::var("AUTOWRITE_EMBED_KEY").unwrap_or_default();
    let provider =
        std::env::var("AUTOWRITE_EMBED_PROVIDER").unwrap_or_else(|_| "anthropic".to_string());

    let out_dir = std::env::var("OUT_DIR").unwrap();
    let out_path = Path::new(&out_dir).join("embedded_key.txt");

    let content = if key.trim().is_empty() {
        // Không nhúng key -> app hoạt động như bình thường (người dùng tự nhập).
        String::new()
    } else {
        let cipher = Aes256Gcm::new(OBF_KEY.into());
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ct = cipher
            .encrypt(&nonce, key.trim().as_bytes())
            .expect("mã hóa key thất bại");
        let mut blob = nonce.to_vec();
        blob.extend_from_slice(&ct);
        format!("{}\n{}", provider.trim(), STANDARD.encode(blob))
    };

    std::fs::write(out_path, content).expect("ghi embedded_key.txt thất bại");
}
