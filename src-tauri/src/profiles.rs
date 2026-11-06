//! Perfiles: cada uno tiene su propia base de datos SQLite y un modo
//! ("dev" o "student") que decide el vocabulario de la interfaz.
//! La lista vive en `<datos de la app>/profiles.json`.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// Nombre heredado de la base del perfil inicial; conservarlo mantiene los datos existentes.
pub const DEFAULT_DB: &str = "daily-dev-log.db";
pub const DEFAULT_ID: &str = "default";
const MODES: [&str; 2] = ["dev", "student"];

/// Bases de datos con migraciones registradas en esta ejecución. Cambiar a una de
/// ellas solo exige recargar las ventanas; a cualquier otra, reiniciar la app.
pub struct Registered {
    pub dbs: Mutex<HashSet<String>>,
    /// Id reservado al arrancar para el próximo perfil que se cree, con sus
    /// migraciones ya registradas: así crearlo tampoco obliga a reiniciar.
    pub spare: Mutex<Option<String>>,
}

pub fn new_id() -> String {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or_default();
    format!("p{stamp}")
}

pub fn db_for(id: &str) -> String {
    format!("perfil-{id}.db")
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub mode: String,
    /// Archivo SQLite dentro del directorio de datos de la app.
    pub db: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Profiles {
    pub active: String,
    pub profiles: Vec<Profile>,
}

impl Default for Profiles {
    fn default() -> Self {
        Profiles {
            active: DEFAULT_ID.into(),
            profiles: vec![Profile {
                id: DEFAULT_ID.into(),
                name: "Desarrollo".into(),
                mode: "dev".into(),
                db: DEFAULT_DB.into(),
            }],
        }
    }
}

fn file(dir: &Path) -> PathBuf {
    dir.join("profiles.json")
}

/// Lee la lista; si falta o está dañada, vuelve a la del perfil inicial.
pub fn load(dir: &Path) -> Profiles {
    let mut profiles: Profiles = std::fs::read_to_string(file(dir))
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default();
    profiles.profiles.retain(|p| MODES.contains(&p.mode.as_str()) && is_safe_db_name(&p.db));
    if profiles.profiles.is_empty() {
        profiles = Profiles::default();
    }
    if !profiles.profiles.iter().any(|p| p.id == profiles.active) {
        profiles.active = profiles.profiles[0].id.clone();
    }
    profiles
}

fn save(dir: &Path, profiles: &Profiles) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(profiles).map_err(|e| e.to_string())?;
    // Escritura atómica: primero a un temporal y luego se renombra.
    let tmp = dir.join("profiles.json.tmp");
    std::fs::write(&tmp, text).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, file(dir)).map_err(|e| e.to_string())
}

/// Solo nombres de archivo simples terminados en .db: nada de rutas.
fn is_safe_db_name(name: &str) -> bool {
    name.ends_with(".db") && !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
        && !name.contains("..")
}

fn validate(name: &str, mode: &str) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 40 {
        return Err("El nombre del perfil debe tener entre 1 y 40 caracteres.".into());
    }
    if !MODES.contains(&mode) {
        return Err("Modo no válido.".into());
    }
    Ok(name.to_string())
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_profiles(app: AppHandle) -> Result<Profiles, String> {
    Ok(load(&data_dir(&app)?))
}

#[tauri::command]
pub fn create_profile(app: AppHandle, name: String, mode: String) -> Result<Profile, String> {
    let name = validate(&name, &mode)?;
    let dir = data_dir(&app)?;
    let mut profiles = load(&dir);
    let registered = app.state::<Registered>();
    let id = registered.spare.lock().map_err(|e| e.to_string())?.take().unwrap_or_else(new_id);
    let profile = Profile { db: db_for(&id), id, name, mode };
    profiles.profiles.push(profile.clone());
    save(&dir, &profiles)?;
    Ok(profile)
}

#[tauri::command]
pub fn update_profile(app: AppHandle, id: String, name: String, mode: String) -> Result<Profiles, String> {
    let name = validate(&name, &mode)?;
    let dir = data_dir(&app)?;
    let mut profiles = load(&dir);
    let profile = profiles.profiles.iter_mut().find(|p| p.id == id).ok_or("El perfil no existe.")?;
    profile.name = name;
    profile.mode = mode;
    save(&dir, &profiles)?;
    Ok(profiles)
}

/// Quita un perfil de la lista. Su archivo de datos se conserva en el disco por
/// seguridad (se puede recuperar a mano). No se puede borrar el perfil activo.
#[tauri::command]
pub fn delete_profile(app: AppHandle, id: String) -> Result<Profiles, String> {
    let dir = data_dir(&app)?;
    let mut profiles = load(&dir);
    if profiles.active == id {
        return Err("No se puede eliminar el perfil activo.".into());
    }
    profiles.profiles.retain(|p| p.id != id);
    save(&dir, &profiles)?;
    Ok(profiles)
}

/// Activa otro perfil. Si su base ya tiene las migraciones registradas en esta
/// ejecución, basta con recargar las ventanas (que abren la base del perfil activo);
/// si no, se reinicia la app para registrarlas.
#[tauri::command]
pub fn switch_profile(app: AppHandle, id: String) -> Result<(), String> {
    let dir = data_dir(&app)?;
    let mut profiles = load(&dir);
    if !profiles.profiles.iter().any(|p| p.id == id) {
        return Err("El perfil no existe.".into());
    }
    let db = profiles.profiles.iter().find(|p| p.id == id).map(|p| p.db.clone()).unwrap_or_default();
    profiles.active = id;
    save(&dir, &profiles)?;

    let registered = app.state::<Registered>().dbs.lock().map_err(|e| e.to_string())?.contains(&db);
    if !registered {
        app.restart();
    }
    for window in app.webview_windows().values() {
        window.eval("window.location.reload()").map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ddl-profiles-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn sin_archivo_usa_el_perfil_inicial() {
        let dir = temp_dir("vacio");
        assert_eq!(load(&dir), Profiles::default());
    }

    #[test]
    fn ignora_perfiles_invalidos_y_corrige_el_activo() {
        let dir = temp_dir("invalido");
        std::fs::write(
            file(&dir),
            r#"{"active":"x","profiles":[{"id":"a","name":"A","mode":"student","db":"perfil-a.db"},{"id":"b","name":"B","mode":"dev","db":"..\\fuera.db"}]}"#,
        )
        .unwrap();
        let profiles = load(&dir);
        assert_eq!(profiles.profiles.len(), 1);
        assert_eq!(profiles.active, "a");
    }

    #[test]
    fn valida_nombre_y_modo() {
        assert!(validate("  ", "dev").is_err());
        assert!(validate("Universidad", "chef").is_err());
        assert_eq!(validate("  Universidad ", "student").unwrap(), "Universidad");
    }
}
