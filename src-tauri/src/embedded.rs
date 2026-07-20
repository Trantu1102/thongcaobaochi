use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;

// Phải trùng với build.rs
const OBF_KEY: &[u8; 32] = b"Autowrite-embed-key-v1-32byteXX!";

// Blob do build.rs sinh ra (rỗng nếu không nhúng key khi build).
const EMBEDDED: &str = include_str!(concat!(env!("OUT_DIR"), "/embedded_key.txt"));

/// Trả về (provider, api_key) nếu app được build kèm key nhúng.
pub fn embedded_key() -> Option<(String, String)> {
    let mut lines = EMBEDDED.lines();
    let provider = lines.next()?.trim().to_string();
    let blob_b64 = lines.next()?.trim();
    if provider.is_empty() || blob_b64.is_empty() {
        return None;
    }
    let blob = STANDARD.decode(blob_b64).ok()?;
    if blob.len() < 12 {
        return None;
    }
    let (nonce_bytes, ct) = blob.split_at(12);
    let cipher = Aes256Gcm::new(OBF_KEY.into());
    let pt = cipher.decrypt(Nonce::from_slice(nonce_bytes), ct).ok()?;
    Some((provider, String::from_utf8(pt).ok()?))
}

/// Provider mà key nhúng thuộc về (để frontend tự chọn đúng nhà cung cấp).
pub fn embedded_provider() -> Option<String> {
    embedded_key().map(|(p, _)| p)
}
