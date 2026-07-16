import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Midi } from '@tonejs/midi';
import { songLibrary } from '../src/data/songLibrary';
import { parseMxl } from '../src/services/mxlParser';
import { parseMusicXmlToMidiBytes } from '../src/services/musicXmlParser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cacheDir = path.resolve(__dirname, '../.test-cache');

// Ensure cache directory exists
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Function to fetch and cache MXL files
async function getMxlBuffer(url: string, index: number): Promise<ArrayBuffer> {
  const filename = url.split('/').pop() || `song_${index}.mxl`;
  const cachePath = path.join(cacheDir, filename);
  
  if (fs.existsSync(cachePath)) {
    const fileBuffer = fs.readFileSync(cachePath);
    // Convert Node Buffer to local realm ArrayBuffer to avoid JSZip realm issues
    const arrayBuffer = new ArrayBuffer(fileBuffer.length);
    new Uint8Array(arrayBuffer).set(fileBuffer);
    return arrayBuffer;
  }
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(cachePath, Buffer.from(arrayBuffer));
  return arrayBuffer;
}

// Interface for detailed note comparison
interface DetailedNote {
  pitch: string;
  time: number;      // in seconds
  duration: number;  // in seconds
}

// Helper to convert step, alter, octave to pitch name
function getNoteName(step: string, alter: number, octave: number): string {
  const steps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const stepIndex = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[step as 'C'|'D'|'E'|'F'|'G'|'A'|'B'] ?? 0;
  let finalIndex = stepIndex + alter;
  let finalOctave = octave;
  
  while (finalIndex < 0) {
    finalIndex += 12;
    finalOctave -= 1;
  }
  while (finalIndex >= 12) {
    finalIndex -= 12;
    finalOctave += 1;
  }
  
  return `${steps[finalIndex]}${finalOctave}`;
}

// Extractor function replicating musicXmlParser's timing and pitch parsing
function extractDetailedNotesFromXml(xmlDoc: Document): DetailedNote[][] {
  const partsNotes: DetailedNote[][] = [];
  const partElements = xmlDoc.getElementsByTagNameNS('*', 'part');
  
  // Thu nhập tất cả các sự kiện thay đổi tempo theo chỉ số measure để chia sẻ giữa các bè
  const tempoMap = new Map<number, number>();
  for (let p = 0; p < partElements.length; p++) {
    const partEl = partElements[p];
    const measures = partEl.getElementsByTagNameNS('*', 'measure');
    for (let m = 0; m < measures.length; m++) {
      const measure = measures[m];
      const soundNodes = measure.getElementsByTagNameNS('*', 'sound');
      for (let s = 0; s < soundNodes.length; s++) {
        if (soundNodes[s].hasAttribute('tempo')) {
          const bpm = parseFloat(soundNodes[s].getAttribute('tempo') || '0');
          if (bpm > 0) {
            tempoMap.set(m, bpm);
          }
        }
      }
    }
  }

  const initialBpm = tempoMap.get(0) || 120;

  for (let p = 0; p < partElements.length; p++) {
    const partEl = partElements[p];
    const notesList: DetailedNote[] = [];
    
    let divisions = 1;
    let currentBpm = initialBpm;
    let timeInSeconds = 0;
    let lastNoteStartTime = 0;
    
    const measures = partEl.getElementsByTagNameNS('*', 'measure');
    for (let m = 0; m < measures.length; m++) {
      const measure = measures[m];
      
      // Cập nhật tempo khi bắt đầu measure nếu có trong tempoMap
      if (tempoMap.has(m)) {
        const newBpm = tempoMap.get(m)!;
        if (newBpm !== currentBpm) {
          currentBpm = newBpm;
        }
      }

      const children = Array.from(measure.childNodes);
      
      children.forEach(child => {
        if (child.nodeType !== 1) return; // ELEMENT_NODE
        const el = child as HTMLElement;
        const tagName = el.localName.toLowerCase();
        
        if (tagName === 'attributes') {
          const divNode = el.getElementsByTagNameNS('*', 'divisions')[0];
          if (divNode) {
            divisions = parseInt(divNode.textContent || '1', 10);
          }
        } 
        else if (tagName === 'direction') {
          const soundNodes = el.getElementsByTagNameNS('*', 'sound');
          for (let s = 0; s < soundNodes.length; s++) {
            if (soundNodes[s].hasAttribute('tempo')) {
              const newBpm = parseFloat(soundNodes[s].getAttribute('tempo') || '120');
              if (newBpm > 0 && newBpm !== currentBpm) {
                currentBpm = newBpm;
              }
              break;
            }
          }
        } 
        else if (tagName === 'backup') {
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          if (durNode) {
            const dur = parseInt(durNode.textContent || '0', 10);
            const beats = dur / divisions;
            timeInSeconds = Math.max(0, timeInSeconds - (beats * (60 / currentBpm)));
          }
        } 
        else if (tagName === 'forward') {
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          if (durNode) {
            const dur = parseInt(durNode.textContent || '0', 10);
            const beats = dur / divisions;
            timeInSeconds += beats * (60 / currentBpm);
          }
        } 
        else if (tagName === 'note') {
          const isRest = el.getElementsByTagNameNS('*', 'rest').length > 0;
          const isChord = el.getElementsByTagNameNS('*', 'chord').length > 0;
          
          const durNode = el.getElementsByTagNameNS('*', 'duration')[0];
          const durationVal = durNode ? parseInt(durNode.textContent || '0', 10) : 0;
          const durationBeats = durationVal / divisions;
          const durationSeconds = durationBeats * (60 / currentBpm);
          
          if (isRest) {
            timeInSeconds += durationSeconds;
          } else {
            const pitchNode = el.getElementsByTagNameNS('*', 'pitch')[0];
            if (pitchNode) {
              const stepNode = pitchNode.getElementsByTagNameNS('*', 'step')[0];
              const step = stepNode?.textContent || 'C';
              const octaveNode = pitchNode.getElementsByTagNameNS('*', 'octave')[0];
              const octave = parseInt(octaveNode?.textContent || '4', 10);
              const alterNode = pitchNode.getElementsByTagNameNS('*', 'alter')[0];
              const alterVal = parseFloat(alterNode?.textContent || '0');
              
              const noteName = getNoteName(step, alterVal, octave);
              
              let startSec = timeInSeconds;
              if (isChord) {
                startSec = lastNoteStartTime;
              } else {
                lastNoteStartTime = timeInSeconds;
              }
              
              notesList.push({
                pitch: noteName,
                time: startSec,
                duration: durationSeconds
              });
              
              if (!isChord) {
                timeInSeconds += durationSeconds;
              }
            }
          }
        }
      });
    }
    
    partsNotes.push(notesList);
  }
  
  return partsNotes;
}

// Function to generate Markdown report content with deep audit columns
function generateMarkdownReport(results: any[]): string {
  let md = `# Báo cáo Kiểm thử Khả năng Đọc Bản Nhạc (Chi tiết đối chiếu ngược)\n\n`;
  md += `Được tạo tự động vào lúc: ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC\n\n`;
  md += `| Tên Bài Hát | Tác Giả | Số Nốt XML | Số Nốt MIDI | Trạng Thái | Chi Tiết Sai Lệch |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :--- |\n`;
  
  results.forEach(res => {
    md += `| ${res.name} | ${res.composer} | ${res.xmlNotes} | ${res.midiNotes} | ${res.status} | ${res.details} |\n`;
  });
  
  const successCount = results.filter(r => r.status.includes('Khớp')).length;
  const errorCount = results.filter(r => r.status.includes('Lỗi')).length;
  const mismatchCount = results.length - successCount - errorCount;
  
  const total = results.length;
  const successPercentage = total > 0 ? ((successCount / total) * 100).toFixed(1) : '0';
  
  md += `\n## Tóm tắt thống kê đối chiếu sâu\n`;
  md += `- Tổng số bài hát đã kiểm tra: **${total}**\n`;
  md += `- Số bài hát khớp nốt và thông số tuyệt đối (cao độ, thời gian): **${successCount}** (${successPercentage}%)\n`;
  md += `- Số bài hát phát hiện lệch nốt hoặc lệch thời lượng: **${mismatchCount}**\n`;
  md += `- Số bài hát bị lỗi xử lý/tải file: **${errorCount}**\n`;
  
  return md;
}

describe('Song Library Note Reading Audit', () => {
  const results: any[] = [];

  it('should scan all songs in library, count XML vs MIDI notes and check for missing notes', { timeout: 300000 }, async () => {
    const activeSongs = songLibrary.filter(song => song.url);
    console.log(`Bắt đầu đối chiếu sâu nốt nhạc của ${activeSongs.length} bài hát...`);

    for (let i = 0; i < activeSongs.length; i++) {
      const song = activeSongs[i];
      const url = song.url!;

      try {
        const buffer = await getMxlBuffer(url, i);
        const xmlText = await parseMxl(buffer);
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');
        
        // Extract detailed notes from XML
        const xmlPartsNotes = extractDetailedNotesFromXml(doc);
        
        // Convert to MIDI bytes
        const midiBytes = parseMusicXmlToMidiBytes(xmlText);
        
        // Parse MIDI notes using ToneJS Midi
        const midi = new Midi(midiBytes.buffer);
        
        let isMatch = true;
        let diffCount = 0;
        let totalXmlNotes = 0;
        let totalMidiNotes = 0;
        const mismatchDetails: string[] = [];

        // Check track counts
        if (xmlPartsNotes.length !== midi.tracks.length) {
          isMatch = false;
          mismatchDetails.push(`Số bè lệch (XML: ${xmlPartsNotes.length}, MIDI: ${midi.tracks.length})`);
        }

        const maxParts = Math.max(xmlPartsNotes.length, midi.tracks.length);
        for (let p = 0; p < maxParts; p++) {
          const xmlNotes = xmlPartsNotes[p] || [];
          const midiTrack = midi.tracks[p];
          const midiNotes = midiTrack ? midiTrack.notes : [];
          
          totalXmlNotes += xmlNotes.length;
          totalMidiNotes += midiNotes.length;
          
          // Sort comparator
          const sortFn = (a: any, b: any) => {
            if (Math.abs(a.time - b.time) > 0.05) {
              return a.time - b.time;
            }
            return (a.pitch || a.name).localeCompare(b.pitch || b.name);
          };
          
          xmlNotes.sort(sortFn);
          
          const mappedMidiNotes = midiNotes.map(n => ({
            pitch: n.name,
            time: n.time,
            duration: n.duration
          }));
          mappedMidiNotes.sort(sortFn);
          
          const maxNotes = Math.max(xmlNotes.length, mappedMidiNotes.length);
          let trackErrors = 0;

          for (let n = 0; n < maxNotes; n++) {
            const xN = xmlNotes[n];
            const mN = mappedMidiNotes[n];
            
            if (!xN) {
              diffCount++;
              isMatch = false;
              trackErrors++;
              if (trackErrors <= 3) mismatchDetails.push(`Bè ${p}: MIDI dư ${mN.pitch} tại ${mN.time.toFixed(2)}s`);
            } else if (!mN) {
              diffCount++;
              isMatch = false;
              trackErrors++;
              if (trackErrors <= 3) mismatchDetails.push(`Bè ${p}: MIDI thiếu ${xN.pitch} tại ${xN.time.toFixed(2)}s`);
            } else {
              const pitchMatch = xN.pitch === mN.pitch;
              const timeMatch = Math.abs(xN.time - mN.time) < 0.05;
              const durMatch = Math.abs(xN.duration - mN.duration) < 0.05;
              
              if (!pitchMatch || !timeMatch || !durMatch) {
                diffCount++;
                isMatch = false;
                trackErrors++;
                if (trackErrors <= 3) {
                  let errStr = `Bè ${p} nốt ${xN.pitch} tại ${xN.time.toFixed(2)}s:`;
                  if (!pitchMatch) errStr += ` Sai nốt (${mN.pitch}).`;
                  if (!timeMatch) errStr += ` Lệch time (MIDI: ${mN.time.toFixed(2)}s).`;
                  if (!durMatch) errStr += ` Lệch dur (XML: ${xN.duration.toFixed(2)}s, MIDI: ${mN.duration.toFixed(2)}s).`;
                  mismatchDetails.push(errStr);
                }
              }
            }
          }
          if (trackErrors > 3) {
            mismatchDetails.push(`Bè ${p}: và ${trackErrors - 3} sai sót khác.`);
          }
        }

        results.push({
          name: song.name,
          composer: song.composer || 'Không rõ',
          xmlNotes: totalXmlNotes,
          midiNotes: totalMidiNotes,
          status: isMatch 
            ? '✅ Khớp tuyệt đối' 
            : `❌ Lệch (${diffCount} điểm)`,
          details: isMatch ? 'Hoàn toàn trùng khớp' : mismatchDetails.join('; ')
        });

        // Basic verification
        expect(totalMidiNotes).toBeGreaterThan(0);
      } catch (err: any) {
        console.error(`Lỗi đối chiếu bài ${song.name}:`, err.message);
        results.push({
          name: song.name,
          composer: song.composer || 'Không rõ',
          xmlNotes: 0,
          midiNotes: 0,
          status: `💥 Lỗi: ${err.message}`,
          details: 'Lỗi tải hoặc phân tích file ZIP/MXL'
        });
      }
    }

    // Generate and write Markdown report
    const markdownReport = generateMarkdownReport(results);
    const reportPath = path.resolve(__dirname, '../tests-report.md');
    fs.writeFileSync(reportPath, markdownReport, 'utf8');
    
    console.log(`Đã xuất báo cáo đối chiếu sâu ra tệp: ${reportPath}`);
  });
});
