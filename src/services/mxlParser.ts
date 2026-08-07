import JSZip from 'jszip';
import { getWasmModule, isWasmAvailable } from './wasmLoader';

/**
 * Giải nén file MXL (compressed MusicXML) và trả về nội dung MusicXML dạng chuỗi.
 * Đã tối ưu hóa sử dụng Rust WASM Engine (với JSZip fallback).
 */
export async function parseMxl(buffer: ArrayBuffer): Promise<string> {
  if (isWasmAvailable()) {
    try {
      const wasm = await getWasmModule();
      if (wasm && typeof wasm.parse_mxl_to_xml_wasm === 'function') {
        const u8 = new Uint8Array(buffer);
        const xmlText = wasm.parse_mxl_to_xml_wasm(u8);
        if (xmlText && xmlText.trim().length > 0) {
          return xmlText;
        }
      }
    } catch (e) {
      console.warn('[MXLParser] Lỗi khi dùng WASM MXL parser, chuyển sang JSZip fallback:', e);
    }
  }

  const zip = await JSZip.loadAsync(buffer);

  // --- Bước 1: Thử đọc META-INF/container.xml ---
  const containerFile = zip.file('META-INF/container.xml');
  if (containerFile) {
    const containerXml = await containerFile.async('text');
    const parser = new DOMParser();
    const doc = parser.parseFromString(containerXml, 'text/xml');
    const rootfileEl = doc.querySelector('rootfile');
    const fullPath = rootfileEl?.getAttribute('full-path');

    if (fullPath) {
      const mainFile = zip.file(fullPath);
      if (mainFile) {
        return await mainFile.async('text');
      }
    }
  }

  // --- Bước 2: Fallback — tìm file .xml lớn nhất ---
  let bestFile: JSZip.JSZipObject | null = null;
  let bestSize = 0;

  zip.forEach((relativePath, file) => {
    if (file.dir) return;
    const lower = relativePath.toLowerCase();
    // Bỏ qua container.xml và các file metadata
    if (lower.includes('meta-inf')) return;
    if (lower.endsWith('.xml') || lower.endsWith('.musicxml')) {
      // Ước lượng kích thước qua tên file (dùng _data nếu có)
      const entry = file as any;
      const size = entry._data?.uncompressedSize || relativePath.length;
      if (size > bestSize) {
        bestSize = size;
        bestFile = file;
      }
    }
  });

  if (bestFile) {
    return await (bestFile as JSZip.JSZipObject).async('text');
  }

  throw new Error('Không tìm thấy file MusicXML trong archive MXL.');
}
