mod claude;
mod commands;
mod db;
mod embedded;
mod prompts;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let conn = db::init(&dir.join("autowrite.db"))?;
            app.manage(commands::AppState {
                db: std::sync::Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::set_api_key,
            commands::has_api_key,
            commands::embedded_provider,
            commands::generate,
            commands::list_documents,
            commands::delete_document
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
