import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { parseMxl } from '../src/services/mxlParser';

describe('parseMxl', () => {
  it('should parse main XML file using META-INF/container.xml', async () => {
    const zip = new JSZip();
    
    // Add container file
    const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
    <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles>
        <rootfile full-path="scores/song.musicxml"/>
      </rootfiles>
    </container>`;
    zip.file('META-INF/container.xml', containerXml);
    
    // Add musicxml file
    const musicXml = `<score-partwise version="3.0"><movement-title>Test Song</movement-title></score-partwise>`;
    zip.file('scores/song.musicxml', musicXml);
    
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    
    const parsedText = await parseMxl(buffer);
    expect(parsedText).toBe(musicXml);
  });

  it('should fallback to largest XML file if META-INF/container.xml is missing', async () => {
    const zip = new JSZip();
    
    // Add multiple xml files of different sizes
    const shortXml = `<short />`;
    const longXml = `<score-partwise version="3.0"><movement-title>A much longer XML content representing the real score</movement-title></score-partwise>`;
    
    zip.file('metadata.xml', shortXml);
    zip.file('score.xml', longXml);
    
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    
    const parsedText = await parseMxl(buffer);
    expect(parsedText).toBe(longXml);
  });

  it('should throw an error if no XML file exists', async () => {
    const zip = new JSZip();
    zip.file('image.png', 'fake image data');
    
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    
    await expect(parseMxl(buffer)).rejects.toThrow('Không tìm thấy file MusicXML trong archive MXL.');
  });
});
