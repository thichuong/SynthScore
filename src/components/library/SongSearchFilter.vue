<template>
  <div class="search-filter-wrapper">
    <!-- Search -->
    <div class="search-bar">
      <Search class="search-icon" />
      <input 
        ref="searchInputRef"
        :value="searchQuery" 
        @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        type="text" 
        placeholder="Tìm kiếm bản nhạc..." 
        class="search-input"
        @keydown.escape="emit('escape')"
      />
    </div>

    <!-- Filter Tabs -->
    <div class="tag-filters">
      <button 
        v-for="tab in (['tất cả', 'có sẵn', 'tải lên', 'ưa thích'] as const)" 
        :key="tab"
        class="filter-tab"
        :class="{ active: activeFilter === tab }"
        @click="emit('update:activeFilter', tab)"
      >
        {{ tab }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Search } from 'lucide-vue-next';

defineProps<{
  searchQuery: string;
  activeFilter: 'tất cả' | 'có sẵn' | 'tải lên' | 'ưa thích';
}>();

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'update:activeFilter', value: 'tất cả' | 'có sẵn' | 'tải lên' | 'ưa thích'): void;
  (e: 'escape'): void;
}>();

const searchInputRef = ref<HTMLInputElement | null>(null);

defineExpose({
  focus: () => searchInputRef.value?.focus()
});
</script>

<style scoped>
.search-filter-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: #181820;
  border-bottom: 1px solid #2a2a38;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #22222e;
  border: 1px solid #323246;
  border-radius: 8px;
  padding: 6px 10px;
}

.search-icon {
  width: 14px;
  height: 14px;
  color: #8c8c9e;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: #22222e;
  border: none;
  color: #ffffff;
  font-size: 0.8rem;
  outline: none;
}

.tag-filters {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.filter-tab {
  background: #22222e;
  border: 1px solid #323246;
  color: #a0a0b0;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  text-transform: capitalize;
}

.filter-tab:hover {
  background: #2c2c3e;
  color: #ffffff;
}

.filter-tab.active {
  background: #0072ff;
  border-color: #00f0ff;
  color: #ffffff;
}
</style>
