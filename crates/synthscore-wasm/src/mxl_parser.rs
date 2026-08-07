use std::io::{Cursor, Read};
use zip::ZipArchive;

/// Extract `MusicXML` string content from compressed MXL ZIP binary bytes.
///
/// # Errors
/// Returns error message if archive is invalid or no `MusicXML` file is found.
#[allow(clippy::case_sensitive_file_extension_comparisons)]
pub fn parse_mxl_bytes(mxl_bytes: &[u8]) -> Result<String, String> {
    let cursor = Cursor::new(mxl_bytes);
    let mut archive = ZipArchive::new(cursor).map_err(|e| format!("Lỗi mở file MXL ZIP: {e}"))?;

    // --- Step 1: Try reading META-INF/container.xml ---
    let mut root_path = None;
    if let Ok(mut container_file) = archive.by_name("META-INF/container.xml") {
        let mut container_xml = String::new();
        if container_file.read_to_string(&mut container_xml).is_ok() {
            // Simple XML extraction for <rootfile full-path="...">
            if let Some(idx) = container_xml.find("full-path=\"") {
                let rest = &container_xml[idx + 11..];
                if let Some(end_idx) = rest.find('"') {
                    root_path = Some(rest[..end_idx].to_string());
                }
            } else if let Some(idx) = container_xml.find("full-path='") {
                let rest = &container_xml[idx + 11..];
                if let Some(end_idx) = rest.find('\'') {
                    root_path = Some(rest[..end_idx].to_string());
                }
            }
        }
    }

    if let Some(path) = root_path {
        if let Ok(mut xml_file) = archive.by_name(&path) {
            let mut xml_text = String::new();
            xml_file
                .read_to_string(&mut xml_text)
                .map_err(|e| format!("Lỗi đọc file MusicXML từ path '{path}': {e}"))?;
            return Ok(xml_text);
        }
    }

    // --- Step 2: Fallback — find largest .xml or .musicxml file ---
    let mut best_name: Option<String> = None;
    let mut best_size: u64 = 0;

    for i in 0..archive.len() {
        if let Ok(file) = archive.by_index(i) {
            let name = file.name().to_string();
            let lower = name.to_lowercase();
            if lower.contains("meta-inf") {
                continue;
            }
            if lower.ends_with(".xml") || lower.ends_with(".musicxml") {
                let size = file.size();
                if size > best_size {
                    best_size = size;
                    best_name = Some(name);
                }
            }
        }
    }

    if let Some(target_name) = best_name {
        if let Ok(mut xml_file) = archive.by_name(&target_name) {
            let mut xml_text = String::new();
            xml_file
                .read_to_string(&mut xml_text)
                .map_err(|e| format!("Lỗi đọc file MusicXML '{target_name}': {e}"))?;
            return Ok(xml_text);
        }
    }

    Err("Không tìm thấy tệp MusicXML hợp lệ trong tệp nén MXL.".to_string())
}
