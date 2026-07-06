<template>
  <div class="file-uploader glass-card">
    <div 
      class="dropzone" 
      :class="{ dragging: isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
      @click="triggerFileSelect"
    >
      <input 
        type="file" 
        ref="fileInput" 
        style="display: none" 
        accept=".mid,.midi,.musicxml,.xml,.mxl,.abc,.sf2"
        @change="handleFileChange"
      />
      
      <div class="uploader-content">
        <div class="icon-stack">
          <UploadCloud class="main-icon animate-bounce" />
          <Music class="sub-icon music-icon" />
          <FileAudio class="sub-icon sf2-icon" />
        </div>
        
        <h4>Kéo thả hoặc nhấp để tải lên tệp tin</h4>
        <p class="formats">
          <strong>Nhạc:</strong> MIDI (.mid), MusicXML (.xml, .musicxml), ABC Notation (.abc)<br />
          <strong>Thư viện âm thanh:</strong> Soundfont (.sf2)
        </p>

        <div class="upload-status" v-if="uploadMsg" :class="statusType">
          {{ uploadMsg }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { UploadCloud, Music, FileAudio } from 'lucide-vue-next';
import { AudioEngine } from '../services/audioEngine';
import { parseMxl } from '../services/mxlParser';
import confetti from 'canvas-confetti';

const emit = defineEmits<{
  (e: 'musicLoaded', payload: { data: Uint8Array | string; type: 'xml' | 'abc' | 'midi'; name: string }): void;
}>();

const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const uploadMsg = ref('');
const statusType = ref<'success' | 'error' | 'info'>('info');

function triggerFileSelect() {
  if (fileInput.value) {
    fileInput.value.click();
  }
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    processFile(target.files[0]);
  }
}

function handleDrop(event: DragEvent) {
  isDragging.value = false;
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    processFile(event.dataTransfer.files[0]);
  }
}

async function processFile(file: File) {
  const fileName = file.name;
  const ext = fileName.split('.').pop()?.toLowerCase();

  uploadMsg.value = `Đang xử lý tệp: ${fileName}...`;
  statusType.value = 'info';

  const reader = new FileReader();

  if (ext === 'sf2') {
    // 1. XỬ LÝ TỆP SOUNDFONT
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        await AudioEngine.loadCustomSoundfont(buffer, fileName);
        uploadMsg.value = `Đã nạp thành công bộ Soundfont tùy chỉnh: ${fileName}!`;
        statusType.value = 'success';
        
        // Hiệu ứng pháo hoa ăn mừng nạp thành công bộ nhạc cụ
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#ff007f', '#00f0ff', '#ffffff']
        });
      } catch (err) {
        uploadMsg.value = 'Không thể nạp file Soundfont. Định dạng tệp có thể bị lỗi.';
        statusType.value = 'error';
      }
    };
    reader.readAsArrayBuffer(file);
  } 
  else if (ext === 'mid' || ext === 'midi') {
    // 2. XỬ LÝ TỆP MIDI
    reader.onload = (e) => {
      const buffer = new Uint8Array(e.target?.result as ArrayBuffer);
      emit('musicLoaded', {
        data: buffer,
        type: 'midi',
        name: fileName
      });
      uploadMsg.value = `Đã nạp bài hát: ${fileName}`;
      statusType.value = 'success';
    };
    reader.readAsArrayBuffer(file);
  } 
  else if (ext === 'mxl') {
    // 3a. XỬ LÝ TỆP MXL (Compressed MusicXML — cần giải nén ZIP)
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const xmlText = await parseMxl(buffer);
        emit('musicLoaded', {
          data: xmlText,
          type: 'xml',
          name: fileName
        });
        uploadMsg.value = `Đã nạp bản nhạc: ${fileName}`;
        statusType.value = 'success';
      } catch (err) {
        uploadMsg.value = 'Không thể giải nén file MXL. Định dạng có thể bị lỗi.';
        statusType.value = 'error';
      }
    };
    reader.readAsArrayBuffer(file);
  } 
  else if (ext === 'xml' || ext === 'musicxml') {
    // 3b. XỬ LÝ TỆP MUSICXML THUẦN (Lưu dưới dạng String)
    reader.onload = (e) => {
      const text = e.target?.result as string;
      emit('musicLoaded', {
        data: text,
        type: 'xml',
        name: fileName
      });
      uploadMsg.value = `Đã nạp bản nhạc: ${fileName}`;
      statusType.value = 'success';
    };
    reader.readAsText(file);
  } 
  else if (ext === 'abc') {
    // 4. XỬ LÝ TỆP ABC NOTATION (Lưu dưới dạng String)
    reader.onload = (e) => {
      const text = e.target?.result as string;
      emit('musicLoaded', {
        data: text,
        type: 'abc',
        name: fileName
      });
      uploadMsg.value = `Đã nạp bản nhạc ABC: ${fileName}`;
      statusType.value = 'success';
    };
    reader.readAsText(file);
  } 
  else {
    uploadMsg.value = 'Định dạng tệp không được hỗ trợ. Vui lòng thử lại.';
    statusType.value = 'error';
  }
}
</script>

<style scoped>
.file-uploader {
  padding: 0;
  overflow: hidden;
  height: 190px;
  background: rgba(26, 26, 36, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.dropzone {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 20px;
  border: 2px dashed rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  cursor: pointer;
  background: rgba(18, 18, 24, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.dropzone:hover, .dropzone.dragging {
  border-color: #00f0ff;
  background: rgba(0, 240, 255, 0.03);
  box-shadow: inset 0 0 20px rgba(0, 240, 255, 0.05);
}

.uploader-content {
  text-align: center;
  pointer-events: none;
}

.icon-stack {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 8px;
}

.main-icon {
  width: 40px;
  height: 40px;
  color: #a0a0b0;
  transition: color 0.3s ease;
}

.dropzone:hover .main-icon {
  color: #00f0ff;
}

.sub-icon {
  position: absolute;
  width: 14px;
  height: 14px;
  bottom: -4px;
  opacity: 0.7;
}

.music-icon {
  left: 30%;
  color: #ff007f;
}

.sf2-icon {
  right: 30%;
  color: #39ff14;
}

h4 {
  margin: 0 0 6px 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: #ffffff;
}

.formats {
  margin: 0;
  font-size: 0.7rem;
  color: #8c8c9e;
  line-height: 1.4;
}

.formats strong {
  color: #c0c0d0;
}

.upload-status {
  margin-top: 10px;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  display: inline-block;
}

.upload-status.info {
  background: rgba(255, 255, 255, 0.05);
  color: #a0a0b0;
}

.upload-status.success {
  background: rgba(57, 255, 20, 0.1);
  color: #39ff14;
  border: 1px solid rgba(57, 255, 20, 0.2);
}

.upload-status.error {
  background: rgba(255, 59, 48, 0.1);
  color: #ff3b30;
  border: 1px solid rgba(255, 59, 48, 0.2);
}
</style>
