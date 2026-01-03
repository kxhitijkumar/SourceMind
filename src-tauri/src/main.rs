// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use serde::Serialize;
use std::io::Write;
use std::path::Path;
use std::fs::File;

#[derive(Serialize)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    children: Option<Vec<FileEntry>>,
}

#[tauri::command]
fn get_directory_tree(path: String) -> Result<Vec<FileEntry>, String> {
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;
    let mut tree = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let path = entry.path().to_string_lossy().into_owned();

        if name.starts_with('.') { continue; }

        let children = if meta.is_dir() {
            Some(get_directory_tree(path.clone())?)
        } else {
            None
        };

        tree.push(FileEntry {
            name,
            path,
            is_dir: meta.is_dir(),
            children,
        });
    }
    tree.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    Ok(tree)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(path, content).map_err(|e| e.to_string())
}

#[derive(Serialize)]
pub struct FileContent {
    content: String,
    is_binary: bool,
}

// Check if a file is binary by looking for null bytes in the first 1KB
fn is_binary_file(path: &str) -> bool {
    if let Ok(mut file) = fs::File::open(path) {
        use std::io::Read;
        let mut buffer = [0; 1024];
        if let Ok(n) = file.read(&mut buffer) {
            return buffer[..n].contains(&0);
        }
    }
    false
}

#[tauri::command]
fn read_file_safe(path: String) -> Result<FileContent, String> {
    if is_binary_file(&path) {
        return Ok(FileContent { content: "".into(), is_binary: true });
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(FileContent { content, is_binary: false })
}

#[tauri::command]
fn write_file_atomic(path: String, content: String) -> Result<(), String> {
    let path = Path::new(&path);
    let temp_path = path.with_extension("tmp");

    // 1. Write to a temporary file first
    {
        let mut temp_file = fs::File::create(&temp_path).map_err(|e| e.to_string())?;
        temp_file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
        temp_file.sync_all().map_err(|e| e.to_string())?;
    }

    // 2. Atomic rename (replaces original file)
    fs::rename(&temp_path, path).map_err(|e| {
        let _ = fs::remove_file(&temp_path); // Cleanup temp file on failure
        e.to_string()
    })?;

    Ok(())
}

#[tauri::command]
fn create_file(path: String) -> Result<(), String> {
    if Path::new(&path).exists() {
        return Err("File already exists".into());
    }
    File::create(path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())?;
    Ok(())
}


fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            read_file_safe,
            write_file_atomic,
            get_directory_tree,
            create_file,
            create_dir  
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}