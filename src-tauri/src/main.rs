#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri::webview::WebviewWindowBuilder;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let url = tauri::WebviewUrl::External("https://slackdone.vercel.app".parse().unwrap());
            WebviewWindowBuilder::new(app, "main", url)
                .title("Slackdone")
                .inner_size(1280.0, 800.0)
                .min_inner_size(400.0, 600.0)
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .hidden_title(true)
                .on_navigation(|url| {
                    let host = url.host_str().unwrap_or("");
                    host.ends_with("slackdone.vercel.app")
                        || host.ends_with("slack.com")
                        || host == "localhost"
                })
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
