<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="isOpen" class="shortcuts-modal-overlay" @click.self="emit('close')">
        <div class="shortcuts-modal-card glass-modal">
          <div class="modal-header">
            <div class="header-title-group">
              <Keyboard class="header-icon animate-pulse" />
              <h3>Bảng Hướng Dẫn Phím Tắt Media</h3>
            </div>
            <button class="close-btn" @click="emit('close')">
              <X class="close-icon" />
            </button>
          </div>

          <div class="modal-body">
            <div class="shortcuts-grid">
              <!-- Nhóm 1: Điều khiển phát nhạc -->
              <div class="shortcuts-group">
                <div class="group-title">
                  <Music class="group-icon" />
                  <span>Phát &amp; Điều khiển</span>
                </div>
                <div class="shortcut-item">
                  <span class="shortcut-desc">Phát / Tạm dừng</span>
                  <div class="key-badges">
                    <kbd>Space</kbd>
                    <kbd>K</kbd>
                  </div>
                </div>
                <div class="shortcut-item">
                  <span class="shortcut-desc">Dừng phát</span>
                  <div class="key-badges">
                    <kbd>Shift + Space</kbd>
                    <kbd>S</kbd>
                  </div>
                </div>
                <div class="shortcut-item">
                  <span class="shortcut-desc">Bài tiếp theo (Next)</span>
                  <div class="key-badges">
                    <kbd>N</kbd>
                    <kbd>Shift + →</kbd>
                  </div>
                </div>
                <div class="shortcut-item">
                  <span class="shortcut-desc">Bài trước đó (Prev)</span>
                  <div class="key-badges">
                    <kbd>P</kbd>
                    <kbd>Shift + ←</kbd>
                  </div>
                </div>
                <div class="shortcut-item">
                  <span class="shortcut-desc">Chế độ Lặp lại (Off / All / One)</span>
                  <div class="key-badges">
                    <kbd>R</kbd>
                  </div>
                </div>
              </div>

              <!-- Nhóm 2: Tua & Âm lượng & Tốc độ -->
              <div class="shortcuts-group">
                <div class="group-title">
                  <Sliders class="group-icon" />
                  <span>Âm lượng &amp; Tua nhạc</span>
                </div>
                <div class="shortcut-item">
                  <span class="shortcut-desc">Tua tới / lùi 5 giây</span>
                  <div class="key-badges">
                    <kbd>←</kbd> <kbd>→</kbd> hoặc <kbd>J</kbd> <kbd>L</kbd>
                  </div>
                </div>
                <div class="shortcut-item">
                  <span class="shortcut-desc">Tăng / giảm âm lượng (±10%)</span>
                  <div class="key-badges">
                    <kbd>↑</kbd> <kbd>↓</kbd>
                  </div>
                </div>
                <div class="shortcut-item">
                  <span class="shortcut-desc">Tắt / bật tiếng (Mute)</span>
                  <div class="key-badges">
                    <kbd>M</kbd>
                  </div>
                </div>
                <div class="shortcut-item">
                  <span class="shortcut-desc">Tăng / giảm tốc độ (±0.1x)</span>
                  <div class="key-badges">
                    <kbd>[</kbd> <kbd>]</kbd>
                  </div>
                </div>
                <div class="shortcut-item">
                  <span class="shortcut-desc">Xem bảng phím tắt này</span>
                  <div class="key-badges">
                    <kbd>?</kbd> hoặc <kbd>H</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-primary" @click="emit('close')">Đã hiểu</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Keyboard, X, Music, Sliders } from 'lucide-vue-next';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();
</script>

<style scoped>
.shortcuts-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(5, 5, 8, 0.75);
  backdrop-filter: blur(10px);
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.shortcuts-modal-card {
  width: 100%;
  max-width: 680px;
  background: rgba(18, 18, 26, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalScaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modalScaleIn {
  from {
    transform: scale(0.9) translateY(10px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

.modal-header {
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  color: #00f0ff;
  width: 20px;
  height: 20px;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: #ffffff;
}

.close-btn {
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.close-icon {
  width: 18px;
  height: 18px;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  max-height: 70vh;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 640px) {
  .shortcuts-grid {
    grid-template-columns: 1fr;
  }
}

.shortcuts-group {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #00f0ff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 8px;
}

.group-icon {
  width: 16px;
  height: 16px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.78rem;
}

.shortcut-desc {
  color: #cbd5e1;
  font-weight: 500;
}

.key-badges {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 7px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.7rem;
  font-weight: 700;
  color: #f1f5f9;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.3);
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.btn-primary {
  background: linear-gradient(135deg, #00f0ff 0%, #0072ff 100%);
  border: none;
  color: #0b0b12;
  padding: 8px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 15px rgba(0, 240, 255, 0.35);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
