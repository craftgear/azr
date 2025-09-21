#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // ウィンドウが作成された後、フォーカスを設定
            if let Some(window) = app.get_webview_window("main") {
                // ウィンドウを前面に表示してフォーカスを設定
                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

