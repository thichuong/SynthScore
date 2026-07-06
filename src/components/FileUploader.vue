<template>
  <div class="file-uploader-compact">
    <button 
      class="upload-btn" 
      :class="{ dragging: isDragging }"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
      @click="triggerFileSelect"
      title="Kéo thả hoặc nhấp để tải lên tệp (.mid, .xml, .abc, .sf2)"
    >
      <input 
        type="file" 
        ref="fileInput" 
        style="display: none" 
        accept=".mid,.midi,.musicxml,.xml,.mxl,.abc,.sf2"
        @change="handleFileChange"
      />
      <UploadCloud class="upload-icon" />
      <span class="upload-text">Tải tệp lên...</span>
    </button>
    <Transition name="fade">
      <div class="upload-status-badge" v-if="uploadMsg" :class="statusType" :title="uploadMsg">
        {{ uploadMsg }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { UploadCloud } from 'lucide-vue-next';
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

  uploadMsg.value = `Đang nạp: ${fileName}`;
  statusType.value = 'info';

  const reader = new FileReader();

  if (ext === 'sf2') {
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        await AudioEngine.loadCustomSoundfont(buffer, fileName);
        uploadMsg.value = `Đã nạp Soundfont: ${fileName}`;
        statusType.value = 'success';
        
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#ff007f', '#00f0ff', '#ffffff']
        });
      } catch (err) {
        uploadMsg.value = 'Lỗi nạp Soundfont sf2.';
        statusType.value = 'error';
      }
    };
    reader.readAsArrayBuffer(file);
  } 
  else if (ext === 'mid' || ext === 'midi') {
    reader.onload = (e) => {
      const buffer = new Uint8Array(e.target?.result as ArrayBuffer);
      emit('musicLoaded', {
        data: buffer,
        type: 'midi',
        name: fileName
      });
      uploadMsg.value = `Đã nạp: ${fileName}`;
      statusType.value = 'success';
    };
    reader.readAsArrayBuffer(file);
  } 
  else if (ext === 'mxl') {
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const xmlText = await parseMxl(buffer);
        emit('musicLoaded', {
          data: xmlText,
          type: 'xml',
          name: fileName
        });
        uploadMsg.value = `Đã nạp: ${fileName}`;
        statusType.value = 'success';
      } catch (err) {
        uploadMsg.value = 'Lỗi giải nén MXL.';
        statusType.value = 'error';
      }
    };
    reader.readAsArrayBuffer(file);
  } 
  else if (ext === 'xml' || ext === 'musicxml') {
    reader.onload = (e) => {
      const text = e.target?.result as string;
      emit('musicLoaded', {
        data: text,
        type: 'xml',
        name: fileName
      });
      uploadMsg.value = `Đã nạp: ${fileName}`;
      statusType.value = 'success';
    };
    reader.readAsText(file);
  } 
  else if (ext === 'abc') {
    reader.onload = (e) => {
      const text = e.target?.result as string;
      emit('musicLoaded', {
        data: text,
        type: 'abc',
        name: fileName
      });
      uploadMsg.value = `Đã nạp: ${fileName}`;
      statusType.value = 'success';
    };
    reader.readAsText(file);
  } 
  else {
    uploadMsg.value = 'Tệp không hỗ trợ.';
    statusType.value = 'error';
  }
}
</script>

<style scoped>
.file-uploader-compact {
  display: flex;
  align-items: center;
  gap: 10px;
}

.upload-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 16px;
  border-radius: 10px;
  color: #f1f1f7;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(5px);
}

.upload-btn:hover, .upload-btn.dragging {
  background: rgba(0, 240, 255, 0.08);
  border-color: #00f0ff;
  color: #ffffff;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
}

.upload-icon {
  width: 16px;
  height: 16px;
  color: #00f0ff;
}

.upload-text {
  white-space: nowrap;
}

.upload-status-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 8px;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  backdrop-filter: blur(5px);
}

.upload-status-badge.info {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a0a0b0;
}

.upload-status-badge.success {
  background: rgba(57, 255, 20, 0.08);
  color: #39ff14;
  border: 1px solid rgba(57, 255, 20, 0.2);
  box-shadow: 0 0 8px rgba(57, 255, 20, 0.1);
}

.upload-status-badge.error {
  background: rgba(255, 59, 48, 0.08);
  color: #ff3b30;
  border: 1px solid rgba(255, 59, 48, 0.2);
  box-shadow: 0 0 8px rgba(255, 59, 48, 0.1);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
