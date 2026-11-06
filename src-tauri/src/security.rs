//! Bloqueo de la app: código numérico (guardado como hash PBKDF2-SHA256) y
//! desbloqueo con Windows Hello. Protege la interfaz frente a quien use tu
//! sesión de Windows; los archivos de datos no se cifran.
//! La configuración vive en `<datos de la app>/seguridad.json` (común a todos los perfiles).

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const FILE: &str = "seguridad.json";
const ITERATIONS: u32 = 150_000;
/// Opciones de bloqueo automático (minutos de inactividad).
const AUTO_LOCK_OPTIONS: [u32; 3] = [1, 5, 15];

/// Serializa lecturas y escrituras del archivo (comandos en paralelo).
static FILE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
struct Pin {
    hash: String,
    salt: String,
    iterations: u32,
    length: u8,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(default)]
struct Security {
    pin: Option<Pin>,
    hello: bool,
    /// None: solo se bloquea al abrir la app.
    auto_lock_minutes: Option<u32>,
    failed: u32,
    /// Hasta cuándo (ms desde 1970) no se admiten intentos.
    locked_until: u64,
}

#[derive(Serialize)]
pub struct Status {
    enabled: bool,
    length: u8,
    hello: bool,
    hello_available: bool,
    auto_lock_minutes: Option<u32>,
    failed: u32,
    locked_until: u64,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct Attempt {
    ok: bool,
    failed: u32,
    locked_until: u64,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or_default()
}

/// Espera tras fallos seguidos, como en iOS: 5 → 1 min, 6 → 5 min, 7 → 15 min, 8+ → 1 h.
fn delay_ms(failed: u32) -> u64 {
    let minutes = match failed {
        0..=4 => 0,
        5 => 1,
        6 => 5,
        7 => 15,
        _ => 60,
    };
    minutes * 60_000
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn unhex(text: &str) -> Option<Vec<u8>> {
    (0..text.len()).step_by(2).map(|i| text.get(i..i + 2).and_then(|b| u8::from_str_radix(b, 16).ok())).collect()
}

fn derive(pin: &str, salt: &[u8], iterations: u32) -> [u8; 32] {
    let mut out = [0u8; 32];
    pbkdf2::pbkdf2_hmac::<sha2::Sha256>(pin.as_bytes(), salt, iterations, &mut out);
    out
}

/// Comparación en tiempo constante.
fn same(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

fn validate_pin(pin: &str) -> Result<(), String> {
    if (pin.len() == 4 || pin.len() == 6) && pin.chars().all(|c| c.is_ascii_digit()) {
        Ok(())
    } else {
        Err("El código debe tener 4 o 6 dígitos.".into())
    }
}

fn new_pin(pin: &str) -> Result<Pin, String> {
    validate_pin(pin)?;
    let mut salt = [0u8; 16];
    getrandom::fill(&mut salt).map_err(|e| e.to_string())?;
    Ok(Pin { hash: hex(&derive(pin, &salt, ITERATIONS)), salt: hex(&salt), iterations: ITERATIONS, length: pin.len() as u8 })
}

fn matches(stored: &Pin, pin: &str) -> bool {
    match (unhex(&stored.salt), unhex(&stored.hash)) {
        (Some(salt), Some(hash)) => same(&derive(pin, &salt, stored.iterations), &hash),
        _ => false,
    }
}

/// Un intento de desbloqueo: respeta la espera vigente y la alarga tras cada fallo.
fn attempt(security: &mut Security, pin: &str, now: u64) -> Attempt {
    let Some(stored) = security.pin.clone() else {
        return Attempt { ok: true, failed: 0, locked_until: 0 };
    };
    if now < security.locked_until {
        return Attempt { ok: false, failed: security.failed, locked_until: security.locked_until };
    }
    if matches(&stored, pin) {
        security.failed = 0;
        security.locked_until = 0;
        return Attempt { ok: true, failed: 0, locked_until: 0 };
    }
    security.failed += 1;
    let delay = delay_ms(security.failed);
    security.locked_until = if delay > 0 { now + delay } else { 0 };
    Attempt { ok: false, failed: security.failed, locked_until: security.locked_until }
}

fn path(dir: &Path) -> PathBuf {
    dir.join(FILE)
}

fn load(dir: &Path) -> Security {
    std::fs::read_to_string(path(dir)).ok().and_then(|text| serde_json::from_str(&text).ok()).unwrap_or_default()
}

fn save(dir: &Path, security: &Security) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let tmp = dir.join(format!("{FILE}.tmp"));
    std::fs::write(&tmp, serde_json::to_vec_pretty(security).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path(dir)).map_err(|e| e.to_string())
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

/// Lee, modifica y guarda el archivo sin que otro comando se cuele en medio.
fn with_security<T>(app: &AppHandle, change: impl FnOnce(&mut Security) -> Result<T, String>) -> Result<T, String> {
    let _guard = FILE_LOCK.lock().map_err(|e| e.to_string())?;
    let dir = data_dir(app)?;
    let mut security = load(&dir);
    let before = security.clone();
    let result = change(&mut security)?;
    if security != before {
        save(&dir, &security)?;
    }
    Ok(result)
}

fn status_of(security: &Security, hello_available: bool) -> Status {
    Status {
        enabled: security.pin.is_some(),
        length: security.pin.as_ref().map(|p| p.length).unwrap_or(6),
        hello: security.hello && security.pin.is_some() && hello_available,
        hello_available,
        auto_lock_minutes: security.auto_lock_minutes,
        failed: security.failed,
        locked_until: security.locked_until,
    }
}

// ─── Windows Hello ─────────────────────────────────────────────────────────────

#[cfg(windows)]
fn hello_is_available() -> bool {
    use windows::Security::Credentials::UI::{UserConsentVerifier, UserConsentVerifierAvailability};
    UserConsentVerifier::CheckAvailabilityAsync()
        .and_then(|op| op.join())
        .map(|availability| availability == UserConsentVerifierAvailability::Available)
        .unwrap_or(false)
}

#[cfg(not(windows))]
fn hello_is_available() -> bool {
    false
}

/// Muestra el diálogo de Windows Hello sobre la ventana `hwnd` y espera la respuesta.
#[cfg(windows)]
fn hello_prompt(hwnd: isize, message: &str) -> Result<bool, String> {
    use windows::core::{factory, HSTRING};
    use windows::Security::Credentials::UI::{UserConsentVerificationResult, UserConsentVerifier};
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::WinRT::IUserConsentVerifierInterop;

    let interop = factory::<UserConsentVerifier, IUserConsentVerifierInterop>().map_err(|e| e.to_string())?;
    let operation = unsafe {
        interop.RequestVerificationForWindowAsync::<windows_future::IAsyncOperation<UserConsentVerificationResult>>(
            HWND(hwnd as *mut _),
            &HSTRING::from(message),
        )
    }
    .map_err(|e| e.to_string())?;
    Ok(operation.join().map_err(|e| e.to_string())? == UserConsentVerificationResult::Verified)
}

#[cfg(not(windows))]
fn hello_prompt(_hwnd: isize, _message: &str) -> Result<bool, String> {
    Err("Windows Hello no está disponible.".into())
}

// ─── Comandos ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn security_status(app: AppHandle) -> Result<Status, String> {
    let available = tauri::async_runtime::spawn_blocking(hello_is_available).await.unwrap_or(false);
    let _guard = FILE_LOCK.lock().map_err(|e| e.to_string())?;
    Ok(status_of(&load(&data_dir(&app)?), available))
}

/// Crea o cambia el código. Si ya hay uno, exige el actual.
#[tauri::command]
pub fn set_pin(app: AppHandle, current: Option<String>, pin: String) -> Result<(), String> {
    let pin = new_pin(&pin)?;
    with_security(&app, |security| {
        if let Some(stored) = &security.pin {
            if !current.as_deref().is_some_and(|c| matches(stored, c)) {
                return Err("El código actual no es correcto.".into());
            }
        }
        security.pin = Some(pin);
        security.failed = 0;
        security.locked_until = 0;
        Ok(())
    })
}

/// Desactiva el bloqueo (exige el código actual).
#[tauri::command]
pub fn disable_pin(app: AppHandle, current: String) -> Result<(), String> {
    with_security(&app, |security| {
        match &security.pin {
            Some(stored) if matches(stored, &current) => {
                *security = Security { auto_lock_minutes: security.auto_lock_minutes, ..Security::default() };
                Ok(())
            }
            Some(_) => Err("El código actual no es correcto.".into()),
            None => Ok(()),
        }
    })
}

#[tauri::command]
pub fn verify_pin(app: AppHandle, pin: String) -> Result<Attempt, String> {
    with_security(&app, |security| Ok(attempt(security, &pin, now_ms())))
}

#[tauri::command]
pub fn set_security_options(app: AppHandle, hello: bool, auto_lock_minutes: Option<u32>) -> Result<(), String> {
    if auto_lock_minutes.is_some_and(|m| !AUTO_LOCK_OPTIONS.contains(&m)) {
        return Err("Opción de bloqueo automático no válida.".into());
    }
    with_security(&app, |security| {
        security.hello = hello;
        security.auto_lock_minutes = auto_lock_minutes;
        Ok(())
    })
}

/// Pide Windows Hello sobre la ventana principal. Si se verifica, borra los fallos.
#[tauri::command]
pub async fn hello_verify(app: AppHandle, reason: String) -> Result<bool, String> {
    let window = app.get_webview_window("main").ok_or("No hay ventana principal.")?;
    #[cfg(windows)]
    let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as isize;
    #[cfg(not(windows))]
    let hwnd = {
        let _ = &window;
        0
    };
    let verified = tauri::async_runtime::spawn_blocking(move || hello_prompt(hwnd, &reason))
        .await
        .map_err(|e| e.to_string())??;
    if verified {
        with_security(&app, |security| {
            security.failed = 0;
            security.locked_until = 0;
            Ok(())
        })?;
    }
    Ok(verified)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn el_codigo_se_guarda_con_hash_y_se_verifica() {
        let pin = new_pin("123456").unwrap();
        assert_ne!(pin.hash, "123456");
        assert_eq!(pin.length, 6);
        assert!(matches(&pin, "123456"));
        assert!(!matches(&pin, "123457"));
        // Cada código lleva su propia sal.
        assert_ne!(new_pin("123456").unwrap().hash, pin.hash);
    }

    #[test]
    fn solo_admite_4_o_6_digitos() {
        assert!(validate_pin("1234").is_ok());
        assert!(validate_pin("123456").is_ok());
        assert!(validate_pin("12345").is_err());
        assert!(validate_pin("12a4").is_err());
    }

    #[test]
    fn los_fallos_seguidos_imponen_esperas_crecientes() {
        let mut security = Security { pin: Some(new_pin("1234").unwrap()), ..Security::default() };
        let now = 1_000_000;
        for _ in 0..4 {
            assert_eq!(attempt(&mut security, "0000", now).locked_until, 0);
        }
        let fifth = attempt(&mut security, "0000", now);
        assert_eq!((fifth.failed, fifth.locked_until), (5, now + 60_000));

        // Durante la espera ni el código correcto entra.
        assert!(!attempt(&mut security, "1234", now + 30_000).ok);
        let sixth = attempt(&mut security, "0000", now + 60_000);
        assert_eq!(sixth.locked_until, now + 60_000 + 300_000);

        let ok = attempt(&mut security, "1234", now + 400_000);
        assert!(ok.ok);
        assert_eq!((security.failed, security.locked_until), (0, 0));
    }
}
