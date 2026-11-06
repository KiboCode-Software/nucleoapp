use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WindowEvent};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_sql::{Migration, MigrationKind};

/// Perfiles: cada uno con su propia base de datos (ver profiles.rs).
mod git;
mod profiles;
mod security;

/// Ventana flotante de captura rápida (definida en tauri.conf.json, oculta al inicio).
const QUICK_CAPTURE: &str = "quick-capture";
const FOCUS_WIDGET: &str = "focus-widget";

/// Prefijo de los archivos de respaldo; solo estos archivos se pueden listar o borrar.
const BACKUP_PREFIX: &str = "nucleo-";
const LEGACY_BACKUP_PREFIX: &str = "daily-dev-log-";

fn is_backup_name(name: &str) -> bool {
    (name.starts_with(BACKUP_PREFIX) || name.starts_with(LEGACY_BACKUP_PREFIX)) && name.ends_with(".db")
}

fn backup_timestamp(path: &Path) -> &str {
    path.file_name()
        .and_then(|name| name.to_str())
        .and_then(|name| name.strip_prefix(BACKUP_PREFIX).or_else(|| name.strip_prefix(LEGACY_BACKUP_PREFIX)))
        .unwrap_or_default()
}

/// Las migraciones SQL viven en `src/database/migrations` para tener una única
/// fuente de verdad que también usan las pruebas del frontend.
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: include_str!("../../src/database/migrations/0001_initial_schema.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "quick_capture",
            sql: include_str!("../../src/database/migrations/0002_quick_capture.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "deadlines",
            sql: include_str!("../../src/database/migrations/0003_deadlines.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "focus_and_review",
            sql: include_str!("../../src/database/migrations/0004_focus_and_review.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

/// Pide al usuario dónde guardar un archivo (diálogo nativo) y escribe `contents` allí.
///
/// La interfaz no recibe permisos generales de escritura en disco: solo puede
/// escribir en la ruta que el usuario elige en este diálogo.
/// Devuelve la ruta guardada, o `None` si el usuario canceló.
#[tauri::command]
async fn export_file(
    app: AppHandle,
    default_name: String,
    contents: String,
    filter_name: String,
    extension: String,
) -> Result<Option<String>, String> {
    let Some(target) = app
        .dialog()
        .file()
        .set_title("Exportar")
        .set_file_name(&default_name)
        .add_filter(filter_name, &[extension.as_str()])
        .blocking_save_file()
    else {
        return Ok(None);
    };

    let path = target.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&path, contents).map_err(|e| format!("No se pudo guardar el archivo: {e}"))?;
    Ok(Some(path.display().to_string()))
}

/// Tamaño máximo de un archivo de importación (los datos de años de uso ocupan pocos MB).
const MAX_IMPORT_BYTES: u64 = 50 * 1024 * 1024;

/// Pide al usuario un archivo JSON (diálogo nativo) y devuelve su contenido,
/// o `None` si canceló. Solo se lee el archivo elegido.
#[tauri::command]
async fn import_file(app: AppHandle) -> Result<Option<String>, String> {
    let Some(source) = app
        .dialog()
        .file()
        .set_title("Importar datos")
        .add_filter("Exportación de Núcleo", &["json"])
        .blocking_pick_file()
    else {
        return Ok(None);
    };

    let path = source.into_path().map_err(|e| e.to_string())?;
    let size = std::fs::metadata(&path).map_err(|e| e.to_string())?.len();
    if size > MAX_IMPORT_BYTES {
        return Err("El archivo es demasiado grande para ser una exportación.".into());
    }
    std::fs::read_to_string(&path).map(Some).map_err(|e| format!("No se pudo leer el archivo: {e}"))
}

/// Ollama siempre en esta máquina: la dirección no es configurable, así que los
/// registros nunca pueden enviarse a otro equipo.
const OLLAMA_URL: &str = "http://127.0.0.1:11434";

#[derive(Serialize)]
struct OllamaStatus {
    running: bool,
    models: Vec<String>,
}

#[derive(serde::Deserialize)]
struct OllamaTags {
    models: Vec<OllamaModel>,
}

#[derive(serde::Deserialize)]
struct OllamaModel {
    name: String,
}

#[derive(serde::Deserialize)]
struct OllamaGenerated {
    response: String,
}

/// ¿Está Ollama en marcha y qué modelos tiene instalados?
#[tauri::command]
async fn ollama_status() -> OllamaStatus {
    tauri::async_runtime::spawn_blocking(|| {
        ureq::get(&format!("{OLLAMA_URL}/api/tags"))
            .timeout(std::time::Duration::from_secs(2))
            .call()
            .ok()
            .and_then(|response| response.into_json::<OllamaTags>().ok())
            .map(|tags| OllamaStatus { running: true, models: tags.models.into_iter().map(|m| m.name).collect() })
            .unwrap_or(OllamaStatus { running: false, models: Vec::new() })
    })
    .await
    .unwrap_or(OllamaStatus { running: false, models: Vec::new() })
}

/// Genera texto con un modelo local de Ollama (sin streaming).
#[tauri::command]
async fn ollama_generate(model: String, prompt: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let response = ureq::post(&format!("{OLLAMA_URL}/api/generate"))
            .timeout(std::time::Duration::from_secs(180))
            .send_json(serde_json::json!({
                "model": model,
                "prompt": prompt,
                "stream": false,
                "options": { "temperature": 0.3 }
            }))
            .map_err(|e| format!("Ollama no respondió: {e}"))?;
        response
            .into_json::<OllamaGenerated>()
            .map(|g| g.response)
            .map_err(|e| format!("Respuesta inesperada de Ollama: {e}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Muestra u oculta la ventana de captura rápida.
fn toggle_quick_capture(app: &AppHandle) {
    let Some(window) = app.get_webview_window(QUICK_CAPTURE) else { return };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
        // La ventana limpia su campo y enfoca el texto al recibir este evento.
        let _ = window.emit("quick-capture:opened", ());
    }
}

#[tauri::command]
fn show_quick_capture(app: AppHandle) {
    if let Some(window) = app.get_webview_window(QUICK_CAPTURE) {
        if !window.is_visible().unwrap_or(false) {
            toggle_quick_capture(&app);
        }
    }
}

#[tauri::command]
fn hide_quick_capture(app: AppHandle) {
    if let Some(window) = app.get_webview_window(QUICK_CAPTURE) {
        let _ = window.hide();
    }
}

/// Muestra el widget del temporizador de enfoque sin quitar el foco a lo que estés
/// haciendo. La primera vez lo coloca arriba a la derecha de la pantalla; después
/// respeta donde lo hayas arrastrado. Si estaba minimizado, lo restaura.
#[tauri::command]
fn show_focus_widget(app: AppHandle) {
    use std::sync::atomic::{AtomicBool, Ordering};
    static PLACED: AtomicBool = AtomicBool::new(false);

    let Some(window) = app.get_webview_window(FOCUS_WIDGET) else { return };
    if !PLACED.swap(true, Ordering::Relaxed) {
        if let (Ok(Some(monitor)), Ok(size)) = (window.current_monitor(), window.outer_size()) {
            let area = monitor.size();
            let margin = (24.0 * monitor.scale_factor()) as i32;
            let x = monitor.position().x + area.width as i32 - size.width as i32 - margin;
            let y = monitor.position().y + margin * 3;
            let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
        }
    }
    if window.is_minimized().unwrap_or(false) {
        let _ = window.unminimize();
    }
    let _ = window.show();
}

#[tauri::command]
fn hide_focus_widget(app: AppHandle) {
    if let Some(window) = app.get_webview_window(FOCUS_WIDGET) {
        let _ = window.hide();
    }
}

/// Carpeta de respaldos: la elegida por el usuario (debe existir) o, por defecto,
/// `<datos de la app>/backups`. Los perfiles distintos del inicial usan una
/// subcarpeta propia, para que la rotación de uno no borre las copias de otro.
#[tauri::command]
fn backup_dir(app: AppHandle, custom: Option<String>, profile: Option<String>) -> Result<String, String> {
    let base = match custom {
        Some(custom) => {
            let dir = PathBuf::from(custom);
            if !dir.is_dir() {
                return Err("La carpeta de respaldos ya no existe.".into());
            }
            dir
        }
        None => app.path().app_data_dir().map_err(|e| e.to_string())?.join("backups"),
    };
    let dir = match profile {
        // Solo ids generados por la app (letras y números), nunca rutas.
        Some(id) if id != profiles::DEFAULT_ID && id.chars().all(|c| c.is_ascii_alphanumeric()) => base.join(id),
        _ => base,
    };
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.display().to_string())
}

/// Diálogo nativo para elegir la carpeta de respaldos.
#[tauri::command]
async fn choose_backup_dir(app: AppHandle) -> Result<Option<String>, String> {
    let folder = app.dialog().file().set_title("Carpeta de respaldos").blocking_pick_folder();
    folder
        .map(|f| f.into_path().map(|p| p.display().to_string()).map_err(|e| e.to_string()))
        .transpose()
}

#[derive(Serialize)]
struct BackupFile {
    path: String,
    size_bytes: u64,
}

fn backup_files(dir: &Path) -> Result<Vec<(PathBuf, std::fs::Metadata)>, String> {
    let mut files: Vec<_> = std::fs::read_dir(dir)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            is_backup_name(&name)
        })
        .filter_map(|entry| entry.metadata().ok().map(|meta| (entry.path(), meta)))
        .filter(|(_, meta)| meta.is_file())
        .collect();
    // Nombres con fecha y hora: el orden alfabético es el cronológico.
    files.sort_by(|a, b| backup_timestamp(&b.0).cmp(backup_timestamp(&a.0)).then_with(|| b.0.cmp(&a.0)));
    Ok(files)
}

/// Tamaño de un respaldo recién creado (solo archivos de respaldo).
#[tauri::command]
fn backup_file_info(path: String) -> Result<BackupFile, String> {
    let path = PathBuf::from(path);
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
    if !is_backup_name(&name) {
        return Err("No es un archivo de respaldo.".into());
    }
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    Ok(BackupFile { path: path.display().to_string(), size_bytes: meta.len() })
}

#[cfg(test)]
mod backup_name_tests {
    use super::is_backup_name;

    #[test]
    fn reconoce_respaldos_actuales_y_anteriores() {
        assert!(is_backup_name("nucleo-2026-11-05-153012.db"));
        assert!(is_backup_name("daily-dev-log-2026-11-01-153012.db"));
        assert!(!is_backup_name("otro-archivo.db"));
        assert!(!is_backup_name("nucleo-2026-11-05-153012.txt"));
    }
}

/// Conserva los `keep` respaldos más recientes de `dir` y borra el resto.
/// Devuelve las rutas eliminadas.
#[tauri::command]
fn prune_backups(dir: String, keep: usize) -> Result<Vec<String>, String> {
    let files = backup_files(Path::new(&dir))?;
    let mut removed = Vec::new();
    for (path, _) in files.into_iter().skip(keep.max(1)) {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
        removed.push(path.display().to_string());
    }
    Ok(removed)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            // Una base de datos por perfil, cada una con sus migraciones. Solo se pueden
            // registrar al arrancar: se añade también la del próximo perfil que se cree.
            let data_dir = app.path().app_data_dir()?;
            let spare = profiles::new_id();
            let mut dbs: std::collections::HashSet<String> =
                profiles::load(&data_dir).profiles.into_iter().map(|p| p.db).collect();
            dbs.insert(profiles::db_for(&spare));
            let mut sql = tauri_plugin_sql::Builder::default();
            for db in &dbs {
                sql = sql.add_migrations(&format!("sqlite:{db}"), migrations());
            }
            app.handle().plugin(sql.build())?;
            app.manage(profiles::Registered { dbs: std::sync::Mutex::new(dbs), spare: std::sync::Mutex::new(Some(spare)) });

            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

                // Ctrl+Shift+Espacio abre la captura rápida desde cualquier aplicación.
                let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
                app.handle().plugin(
                    tauri_plugin_global_shortcut::Builder::new()
                        .with_handler(move |app, pressed, event| {
                            if pressed == &shortcut && event.state() == ShortcutState::Pressed {
                                toggle_quick_capture(app);
                            }
                        })
                        .build(),
                )?;
                // Si otra aplicación ya usa el atajo, la app sigue funcionando sin él.
                if let Err(error) = app.global_shortcut().register(shortcut) {
                    eprintln!("No se pudo registrar el atajo global: {error}");
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| match (window.label(), event) {
            // Como un panel de Spotlight: se oculta al perder el foco.
            (QUICK_CAPTURE, WindowEvent::Focused(false)) => {
                let _ = window.hide();
            }
            // La ventana de captura sigue viva (oculta); al cerrar la principal, se cierra todo.
            ("main", WindowEvent::CloseRequested { .. }) => window.app_handle().exit(0),
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            export_file,
            show_quick_capture,
            hide_quick_capture,
            show_focus_widget,
            hide_focus_widget,
            backup_dir,
            choose_backup_dir,
            backup_file_info,
            prune_backups,
            profiles::get_profiles,
            profiles::create_profile,
            profiles::update_profile,
            profiles::delete_profile,
            profiles::switch_profile,
            security::security_status,
            security::set_pin,
            security::disable_pin,
            security::verify_pin,
            security::set_security_options,
            security::hello_verify,
            git::git_commits,
            git::choose_git_repo,
            import_file,
            ollama_status,
            ollama_generate
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
