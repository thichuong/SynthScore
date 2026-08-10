<template>
  <div class="reverb-selector" ref="selectorRef">
    <!-- Trigger Button -->
    <button 
      type="button"
      class="reverb-trigger" 
      :class="{ 'is-open': isOpen }"
      @click="toggleDropdown"
      :title="currentOption ? currentOption.name : 'Chọn kiểu phòng'"
    >
      <span class="trigger-icon">{{ currentOption?.emoji || '🎵' }}</span>
      <span class="trigger-text">{{ currentOption ? currentOption.name : 'Chọn kiểu phòng' }}</span>
      <ChevronDown class="trigger-chevron" :class="{ rotated: isOpen }" />
    </button>

    <!-- Dropdown Panel (Teleport sang body để hoàn toàn không bị giới hạn bởi overflow/parent card) -->
    <Teleport to="body">
      <Transition name="dropdown">
        <div 
          v-if="isOpen" 
          class="reverb-dropdown-panel"
          :style="dropdownStyle"
          ref="dropdownPanelRef"
        >
          <div class="options-list">
            <div 
              v-for="opt in reverbOptions" 
              :key="opt.value" 
              class="option-item"
              :class="{ 'is-selected': opt.value === modelValue }"
              @click="selectOption(opt.value)"
            >
              <span class="option-icon">{{ opt.emoji }}</span>
              <span class="option-name">{{ opt.name }}</span>
              <Check v-if="opt.value === modelValue" class="check-icon" />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { ChevronDown, Check } from 'lucide-vue-next';

export interface ReverbOption {
  value: number;
  name: string;
  emoji: string;
}

const props = defineProps<{
  modelValue: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
  (e: 'change', value: number): void;
}>();

const reverbOptions: ReverbOption[] = [
  { value: 0, name: 'Phòng Nhỏ 1 (Room 1)', emoji: '🏠' },
  { value: 1, name: 'Phòng Nhỏ 2 (Room 2)', emoji: '🏡' },
  { value: 2, name: 'Phòng Trung Bình (Chamber)', emoji: '🏛️' },
  { value: 3, name: 'Khán Phòng Lớn (Concert Hall)', emoji: '🎼' },
  { value: 4, name: 'Phòng Vang Sắt (Plate Reverb)', emoji: '⚡' },
  { value: 6, name: 'Vang Lặp (Delay)', emoji: '🔁' },
  { value: 7, name: 'Vang Đảo Kênh (Panning Delay)', emoji: '↔️' },
];

const isOpen = ref(false);
const selectorRef = ref<HTMLElement | null>(null);
const dropdownPanelRef = ref<HTMLElement | null>(null);

const dropdownStyle = ref<{ top: string; left: string; width: string }>({
  top: '0px',
  left: '0px',
  width: '0px'
});

const currentOption = computed(() => {
  return reverbOptions.find(opt => opt.value === props.modelValue) || reverbOptions[0];
});

function updateDropdownPosition() {
  if (selectorRef.value) {
    const rect = selectorRef.value.getBoundingClientRect();
    dropdownStyle.value = {
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${Math.max(rect.width, 240)}px`
    };
  }
}

function openDropdown() {
  updateDropdownPosition();
  isOpen.value = true;
}

function closeDropdown() {
  isOpen.value = false;
}

function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown();
  } else {
    openDropdown();
  }
}

function selectOption(val: number) {
  emit('update:modelValue', val);
  emit('change', val);
  closeDropdown();
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  if (
    isOpen.value &&
    selectorRef.value &&
    !selectorRef.value.contains(target) &&
    dropdownPanelRef.value &&
    !dropdownPanelRef.value.contains(target)
  ) {
    closeDropdown();
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    closeDropdown();
  }
}

function handleScrollOrResize() {
  if (isOpen.value) {
    updateDropdownPosition();
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('scroll', handleScrollOrResize, true);
  window.addEventListener('resize', handleScrollOrResize);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('scroll', handleScrollOrResize, true);
  window.removeEventListener('resize', handleScrollOrResize);
});
</script>

<style scoped>
.reverb-selector {
  position: relative;
  width: 100%;
}

.reverb-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #ffffff;
  font-size: 0.96rem;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  text-align: left;
}

.reverb-trigger:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(168, 85, 247, 0.3);
  box-shadow: 0 0 10px rgba(168, 85, 247, 0.15);
}

.reverb-trigger.is-open {
  border-color: #c084fc;
  background: rgba(168, 85, 247, 0.1);
  box-shadow: 0 0 12px rgba(168, 85, 247, 0.25);
}

.trigger-icon {
  flex-shrink: 0;
  font-size: 1.1rem;
}

.trigger-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trigger-chevron {
  width: 18px;
  height: 18px;
  color: #94a3b8;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.trigger-chevron.rotated {
  transform: rotate(180deg);
}

/* === Dropdown Panel (Teleported to Body) === */
.reverb-dropdown-panel {
  position: fixed;
  background: rgba(16, 16, 24, 0.96);
  border: 1px solid rgba(168, 85, 247, 0.3);
  border-radius: 10px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.7), 0 0 16px rgba(168, 85, 247, 0.25);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  will-change: opacity, transform;
  transform-origin: top center;
}

/* GPU Accelerated Smooth Transition (Không bị giật) */
.dropdown-enter-active {
  transition: opacity 0.15s ease-out, transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}
.dropdown-leave-active {
  transition: opacity 0.12s ease-in, transform 0.12s ease-in;
}
.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.options-list {
  max-height: 260px;
  overflow-y: auto;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.options-list::-webkit-scrollbar {
  width: 4px;
}

.options-list::-webkit-scrollbar-track {
  background: transparent;
}

.options-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
  font-size: 0.95rem;
  color: #cbd5e1;
}

.option-item:hover {
  background: rgba(168, 85, 247, 0.15);
  color: #ffffff;
}

.option-item.is-selected {
  background: rgba(168, 85, 247, 0.25);
  color: #e9d5ff;
  font-weight: 600;
}

.option-icon {
  font-size: 1.05rem;
  flex-shrink: 0;
}

.option-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.check-icon {
  width: 17px;
  height: 17px;
  color: #c084fc;
  flex-shrink: 0;
}
</style>
