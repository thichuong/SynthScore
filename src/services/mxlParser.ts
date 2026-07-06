import JSZip from 'jszip';

/**
 * Giải nén file MXL (compressed MusicXML) và trả về nội dung MusicXML dạng chuỗi.
 *
 * File .mxl là một archive ZIP chứa:
 * - META-INF/container.xml — chỉ định rootfile (đường dẫn tới file XML chính)
 * - Một hoặc nhiều file .xml chứa nội dung MusicXML thực tế
 *
 * Hàm này sẽ:
 * 1. Đọc container.xml để tìm rootfile
 * 2. Nếu không có container.xml, tìm file .xml lớn nhất trong archive
 * 3. Trả về nội dung text của file MusicXML chính
 */
export async function parseMxl(buffer: ArrayBuffer): Promise<string> {
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
