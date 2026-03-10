#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri::webview::WebviewWindowBuilder;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_deep_link::DeepLinkExt;
use url::Url;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let url = tauri::WebviewUrl::External("https://slackdone.vercel.app".parse().unwrap());
            let handle = app.handle().clone();
            WebviewWindowBuilder::new(app, "main", url)
                .title("Slackdone")
                .inner_size(1280.0, 800.0)
                .min_inner_size(400.0, 600.0)
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .hidden_title(true)
                .traffic_light_position(tauri::Position::Logical(tauri::LogicalPosition::new(14.0, 22.0)))
                .disable_drag_drop_handler()
                .initialization_script(r#"
                    window.__TAURI_APP__ = true;
                    console.log('[Tauri] Init script running. __TAURI_INTERNALS__:', typeof window.__TAURI_INTERNALS__);
                    document.addEventListener('mousedown', function(e) {
                        if (e.buttons !== 1) return;
                        var el = e.target;
                        while (el) {
                            if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.tagName === 'A') return;
                            if (el.getAttribute && el.getAttribute('data-tauri-drag-region') !== null) {
                                console.log('[Tauri] Drag region hit. __TAURI_INTERNALS__:', typeof window.__TAURI_INTERNALS__, window.__TAURI_INTERNALS__);
                                if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
                                    e.preventDefault();
                                    window.__TAURI_INTERNALS__.invoke('plugin:window|start_dragging', { label: 'main' })
                                        .then(function() { console.log('[Tauri] startDragging succeeded'); })
                                        .catch(function(err) { console.error('[Tauri] startDragging failed:', err); });
                                }
                                return;
                            }
                            el = el.parentElement;
                        }
                    });
                "#)
                .on_navigation(move |nav_url| {
                    let host = nav_url.host_str().unwrap_or("");
                    let path = nav_url.path();

                    // Intercept auth routes and redirect to browser with ?source=desktop
                    if host.ends_with("slackdone.vercel.app")
                        && (path == "/api/auth/login" || path == "/api/auth/install")
                    {
                        let mut auth_url = nav_url.clone();
                        auth_url.query_pairs_mut().append_pair("source", "desktop");
                        let _ = handle.opener().open_url(auth_url.as_str(), None::<&str>);
                        return false;
                    }

                    // Block any direct Slack navigation (shouldn't happen now, but just in case)
                    if host.ends_with("slack.com") {
                        let _ = handle.opener().open_url(nav_url.as_str(), None::<&str>);
                        return false;
                    }

                    true
                })
                .build()?;

            // Handle deep links (slackdone://auth/session?token=...)
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for deep_url in event.urls() {
                    let url_str = deep_url.as_str();
                    if let Ok(parsed) = Url::parse(url_str) {
                        if parsed.scheme() == "slackdone" {
                            if let Some(window) = handle.get_webview_window("main") {
                                // slackdone://auth/session parses as host=auth, path=/session
                                let host = parsed.host_str().unwrap_or("");
                                let path = parsed.path().trim_start_matches('/');
                                let full = format!("{}/{}", host, path).trim_matches('/').to_string();

                                if full.contains("session") {
                                    if let Some(token) = parsed.query_pairs()
                                        .find(|(k, _)| k == "token")
                                        .map(|(_, v)| v.to_string())
                                    {
                                        // Sanitize token: only allow base64url + dot (valid HMAC token chars)
                                        let safe_token: String = token.chars()
                                            .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
                                            .collect();
                                        let js = format!(
                                            "document.cookie = 'session={}; path=/; max-age=604800'; window.location.href = 'https://slackdone.vercel.app';",
                                            safe_token
                                        );
                                        let _ = window.eval(&js);
                                    }
                                } else {
                                    let _ = window.eval("window.location.href = 'https://slackdone.vercel.app';");
                                }
                                let _ = window.set_focus();
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
