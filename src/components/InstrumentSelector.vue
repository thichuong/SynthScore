<template>
  <div class="instrument-selector" ref="selectorRef">
    <!-- Trigger Button -->
    <button 
      type="button"
      class="selector-trigger" 
      :class="{ 'is-open': isOpen }"
      @click="toggleDropdown"
      :title="currentInstrument ? currentInstrument.name : 'Chọn nhạc cụ'"
    >
      <span class="trigger-icon">{{ currentGroupEmoji }}</span>
      <span class="trigger-text">{{ currentInstrument ? currentInstrument.name : 'Chọn nhạc cụ' }}</span>
      <ChevronDown class="trigger-chevron" :class="{ rotated: isOpen }" />
    </button>

    <!-- Dropdown Panel -->
    <Transition name="dropdown">
      <div v-if="isOpen" class="dropdown-panel">
        <!-- Search bar -->
        <div class="search-bar">
          <Search class="search-icon" />
          <input 
            ref="searchInputRef"
            v-model="searchQuery" 
            type="text" 
            placeholder="Tìm kiếm nhạc cụ..." 
            class="search-input"
            @keydown.escape="closeDropdown"
          />
          <button v-if="searchQuery" type="button" class="clear-search-btn" @click="searchQuery = ''">
            <X class="clear-icon" />
          </button>
        </div>

        <!-- Scrollable Options List -->
        <div class="options-list" ref="optionsListRef">
          <!-- Filtered List (when searching) -->
          <template v-if="searchQuery">
            <div 
              v-for="inst in filteredInstruments" 
              :key="inst.number" 
              class="option-item"
              :class="{ 'is-selected': inst.number === modelValue }"
              @click="selectInstrument(inst.number)"
            >
              <span class="option-icon">{{ inst.emoji }}</span>
              <div class="option-info">
                <span class="option-name">{{ inst.name }}</span>
                <span class="option-group-name">{{ inst.groupName }}</span>
              </div>
            </div>
            <div v-if="filteredInstruments.length === 0" class="empty-state">
              Không tìm thấy nhạc cụ "{{ searchQuery }}"
            </div>
          </template>

          <!-- Grouped List (default view) -->
          <template v-else>
            <div v-for="group in instrumentGroupsWithEmojis" :key="group.name" class="group-section">
              <div class="group-header">
                <span class="group-header-emoji">{{ group.emoji }}</span>
                <span class="group-header-title">{{ group.displayName }}</span>
              </div>
              <div class="group-options">
                <div 
                  v-for="inst in group.instruments" 
                  :key="inst.number" 
                  class="option-item"
                  :class="{ 'is-selected': inst.number === modelValue }"
                  @click="selectInstrument(inst.number)"
                >
                  <span class="option-icon">{{ group.emoji }}</span>
                  <span class="option-name">{{ inst.name }}</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { ChevronDown, Search, X } from 'lucide-vue-next';
import { instrumentGroups } from '../data/instruments';
import type { InstrumentInfo } from '../data/instruments';

const props = defineProps<{
  modelValue: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
  (e: 'change', value: number): void;
  (e: 'open'): void;
  (e: 'close'): void;
}>();

const isOpen = ref(false);
const searchQuery = ref('');

const selectorRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const optionsListRef = ref<HTMLElement | null>(null);

// Parse group name to split Emoji and text (e.g. "🎹 Piano" -> emoji: "🎹", text: "Piano")
const instrumentGroupsWithEmojis = computed(() => {
  return instrumentGroups.map(group => {
    // Emojis are usually the first character(s)
    const match = group.name.match(/^([\p{Emoji}\u200d]+)\s*(.*)$/u);
    const emoji = match ? match[1] : '🎵';
    const displayName = match ? match[2] : group.name;
    return {
      ...group,
      emoji,
      displayName
    };
  });
});

// Flat list of all instruments with their group emoji & group name for searching
const allInstrumentsFlat = computed(() => {
  const list: Array<InstrumentInfo & { emoji: string; groupName: string }> = [];
  instrumentGroupsWithEmojis.value.forEach(group => {
    group.instruments.forEach(inst => {
      list.push({
        ...inst,
        emoji: group.emoji,
        groupName: group.displayName
      });
    });
  });
  return list;
});

// Find current instrument and its group emoji
const currentInstrument = computed(() => {
  return allInstrumentsFlat.value.find(inst => inst.number === props.modelValue) || null;
});

const currentGroupEmoji = computed(() => {
  return currentInstrument.value ? currentInstrument.value.emoji : '🎵';
});

// Filtered instruments during search
const filteredInstruments = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return [];
  return allInstrumentsFlat.value.filter(inst => 
    inst.name.toLowerCase().includes(query) || 
    inst.groupName.toLowerCase().includes(query)
  );
});

function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown();
  } else {
    openDropdown();
  }
}

function openDropdown() {
  isOpen.value = true;
  searchQuery.value = '';
  emit('open');
  nextTick(() => {
    searchInputRef.value?.focus();
    scrollToSelected();
  });
}

function closeDropdown() {
  isOpen.value = false;
  emit('close');
}

function selectInstrument(number: number) {
  emit('update:modelValue', number);
  emit('change', number);
  closeDropdown();
}

function scrollToSelected() {
  nextTick(() => {
    const container = optionsListRef.value;
    if (!container) return;
    const selectedEl = container.querySelector('.is-selected');
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest', behavior: 'instant' as any });
    }
  });
}

function handleClickOutside(e: MouseEvent) {
  if (selectorRef.value && !selectorRef.value.contains(e.target as Node)) {
    closeDropdown();
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    closeDropdown();
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.instrument-selector {
  position: relative;
  width: 100%;
}

/* === Trigger Button === */
.selector-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #e2e2e9;
  font-size: 0.72rem;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  text-align: left;
}

.selector-trigger:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(0, 240, 255, 0.25);
  box-shadow: 0 0 8px rgba(0, 240, 255, 0.15);
}

.selector-trigger.is-open {
  border-color: #00f0ff;
  background: rgba(0, 240, 255, 0.05);
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.15);
}

.trigger-icon {
  flex-shrink: 0;
  font-size: 0.8rem;
}

.trigger-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trigger-chevron {
  width: 12px;
  height: 12px;
  color: #8c8c9e;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.trigger-chevron.rotated {
  transform: rotate(180deg);
}

/* === Dropdown Panel === */
.dropdown-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  min-width: 210px;
  background: rgba(16, 16, 22, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 1px rgba(0, 240, 255, 0.2);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Transition */
.dropdown-enter-active {
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}
.dropdown-leave-active {
  transition: all 0.1s ease-in;
}
.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
}
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-2px) scale(0.99);
}

/* === Search Bar === */
.search-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.15);
}

.search-icon {
  width: 12px;
  height: 12px;
  color: #8c8c9e;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  color: #ffffff;
  font-size: 0.72rem;
  font-family: inherit;
  outline: none;
}

.search-input::placeholder {
  color: #5c5c6e;
}

.clear-search-btn {
  background: none;
  border: none;
  padding: 2px;
  color: #8c8c9e;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-search-btn:hover {
  color: #ffffff;
}

.clear-icon {
  width: 10px;
  height: 10px;
}

/* === Options List === */
.options-list {
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
}

.options-list::-webkit-scrollbar {
  width: 4px;
}

.options-list::-webkit-scrollbar-track {
  background: transparent;
}

.options-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.options-list::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 240, 255, 0.2);
}

/* Group Headers */
.group-section {
  margin-bottom: 4px;
}

.group-section:last-child {
  margin-bottom: 0;
}

.group-header {
  position: sticky;
  top: 0;
  background: rgba(20, 20, 28, 0.98);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  font-size: 0.65rem;
  font-weight: 700;
  color: #00f0ff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  z-index: 10;
}

.group-header-emoji {
  font-size: 0.7rem;
}

/* Option Item */
.option-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.1s ease;
  font-size: 0.7rem;
  color: #b5b5c0;
}

.option-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
}

.option-item.is-selected {
  background: linear-gradient(90deg, rgba(0, 240, 255, 0.15) 0%, rgba(0, 114, 255, 0.05) 100%);
  color: #ffffff;
  border-left: 2px solid #00f0ff;
  font-weight: 600;
}

.option-icon {
  font-size: 0.72rem;
  flex-shrink: 0;
}

.option-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.option-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.option-group-name {
  font-size: 0.58rem;
  color: #7c7c8e;
}

.empty-state {
  padding: 16px 8px;
  text-align: center;
  font-size: 0.68rem;
  color: #5c5c6e;
}
</style>
