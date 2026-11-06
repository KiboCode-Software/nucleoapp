//! Commits del día en los repositorios de Git locales que elija el usuario
//! (modo desarrollo). Solo lee: ejecuta `git log` y `git config`, nunca escribe.

use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

/// Separadores que no aparecen en un mensaje de commit normal.
const FIELD: char = '\u{1f}';
const RECORD: char = '\u{1e}';

#[derive(Serialize, Debug, PartialEq)]
pub struct Commit {
    repo: String,
    hash: String,
    /// Fecha del autor en ISO 8601 con zona.
    date: String,
    subject: String,
}

fn git(dir: &Path, args: &[&str]) -> Result<String, String> {
    let mut command = Command::new("git");
    command.arg("-C").arg(dir).args(args);
    // Sin ventana de consola parpadeando en Windows.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    let output = command.output().map_err(|_| "No se encontró Git. Instálalo y vuelve a intentarlo.".to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn is_date(text: &str) -> bool {
    text.len() == 10 && text.chars().enumerate().all(|(i, c)| if i == 4 || i == 7 { c == '-' } else { c.is_ascii_digit() })
}

fn parse_log(repo: &str, output: &str) -> Vec<Commit> {
    output
        .split(RECORD)
        .filter_map(|record| {
            let mut fields = record.trim_matches(['\n', '\r']).split(FIELD);
            let hash = fields.next()?.trim();
            let date = fields.next()?;
            let subject = fields.next()?;
            (!hash.is_empty()).then(|| Commit { repo: repo.into(), hash: hash.into(), date: date.into(), subject: subject.trim().into() })
        })
        .collect()
}

fn repo_name(dir: &Path) -> String {
    dir.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| dir.display().to_string())
}

/// Commits propios (por el email de `git config user.email` de cada repositorio)
/// entre dos días locales, ambos incluidos. Los repositorios que fallan se omiten.
#[tauri::command]
pub async fn git_commits(repos: Vec<String>, from: String, to: String) -> Result<Vec<Commit>, String> {
    if !is_date(&from) || !is_date(&to) {
        return Err("Fechas no válidas.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut commits = Vec::new();
        let mut errors = Vec::new();
        for repo in repos.iter().take(20) {
            let dir = PathBuf::from(repo);
            let email = git(&dir, &["config", "user.email"]).unwrap_or_default();
            let since = format!("--since={from} 00:00");
            let until = format!("--until={to} 23:59:59");
            let format = format!("--pretty=format:%H{FIELD}%aI{FIELD}%s{RECORD}");
            let mut args = vec!["log", "--all", "--no-merges", since.as_str(), until.as_str(), format.as_str()];
            let author = format!("--author={}", email.trim());
            if !email.trim().is_empty() {
                args.push(author.as_str());
            }
            match git(&dir, &args) {
                Ok(output) => commits.extend(parse_log(&repo_name(&dir), &output)),
                Err(error) => errors.push(error),
            }
        }
        // Solo es un error si no se pudo leer ninguno.
        if commits.is_empty() && !errors.is_empty() && errors.len() == repos.len().min(20) {
            return Err(errors.remove(0));
        }
        commits.sort_by(|a, b| a.date.cmp(&b.date));
        Ok(commits)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Diálogo para elegir un repositorio; devuelve su carpeta raíz (aunque se elija una subcarpeta).
#[tauri::command]
pub async fn choose_git_repo(app: AppHandle) -> Result<Option<String>, String> {
    let Some(folder) = app.dialog().file().set_title("Repositorio de Git").blocking_pick_folder() else {
        return Ok(None);
    };
    let dir = folder.into_path().map_err(|e| e.to_string())?;
    let root = git(&dir, &["rev-parse", "--show-toplevel"]).map_err(|_| "Esa carpeta no es un repositorio de Git.".to_string())?;
    Ok(Some(PathBuf::from(root.trim()).display().to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn interpreta_la_salida_de_git_log() {
        let output = format!(
            "abc123{FIELD}2026-11-02T10:15:00-05:00{FIELD}feat: login con Google{RECORD}\ndef456{FIELD}2026-11-02T18:40:00-05:00{FIELD}fix: token caducado {RECORD}"
        );
        assert_eq!(
            parse_log("api", &output),
            vec![
                Commit { repo: "api".into(), hash: "abc123".into(), date: "2026-11-02T10:15:00-05:00".into(), subject: "feat: login con Google".into() },
                Commit { repo: "api".into(), hash: "def456".into(), date: "2026-11-02T18:40:00-05:00".into(), subject: "fix: token caducado".into() },
            ]
        );
        assert!(parse_log("api", "").is_empty());
    }

    #[test]
    fn valida_las_fechas() {
        assert!(is_date("2026-11-02"));
        assert!(!is_date("2026-11-2"));
        assert!(!is_date("2026-11-02; rm"));
    }
}
