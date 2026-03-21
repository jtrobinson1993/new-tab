<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Icon } from '@iconify/vue'

const ENGINE_KEY = 'search-engine'

interface SearchEngine {
  id: string
  name: string
  url: string
}

const engines: SearchEngine[] = [
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=' },
]

const query = ref('')
const selectedEngine = ref('duckduckgo')
const searchInput = ref<HTMLInputElement | null>(null)

function loadEngine() {
  const saved = localStorage.getItem(ENGINE_KEY)
  if (saved && engines.some((e) => e.id === saved)) {
    selectedEngine.value = saved
  }
}

function setEngine(id: string) {
  selectedEngine.value = id
  localStorage.setItem(ENGINE_KEY, id)
}

function search() {
  const q = query.value.trim()
  if (!q) return
  const engine = engines.find((e) => e.id === selectedEngine.value) ?? engines[0]!
  window.location.href = engine!.url + encodeURIComponent(q)
}

onMounted(() => {
  loadEngine()
  searchInput.value?.focus()
})
</script>

<template>
  <div class="search-container">
    <form @submit.prevent="search" class="search-form">
      <input
        ref="searchInput"
        v-model="query"
        type="text"
        class="search-input"
        placeholder="Search..."
        autocomplete="off"
        spellcheck="false"
      />
    </form>
    <div class="engine-options">
      <label
        v-for="engine in engines"
        :key="engine.id"
        class="engine-label"
        :class="{ active: selectedEngine === engine.id }"
        @click="setEngine(engine.id)"
      >
{{ engine.name }}
      </label>
    </div>
  </div>
</template>

<style scoped>

.search-form {
  width: 100%;
}

.search-input {
  width: 560px;
  max-width: 90vw;
  padding: 14px 20px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #e0e0e0;
  font-size: 1.1rem;
  font-family: system-ui, -apple-system, sans-serif;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
  box-sizing: border-box;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.33);
}

.search-input:focus {
  border-color: rgba(255, 255, 255, 0.3);
  background: rgba(0, 0, 0, 0.45);
}

.engine-options {
  display: flex;
  gap: 4px;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 8px;
  padding: 4px;
}

.engine-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 0.8rem;
  color: #999;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  padding: 5px 12px;
  border-radius: 6px;
}

.engine-label.active {
  color: #e0e0e0;
  background: rgba(255, 255, 255, 0.1);
}

.engine-label:hover:not(.active) {
  color: #ccc;
}

</style>

<style>
.search-container {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  z-index: 10;
}

@container main (max-width: 1280px) {
  .search-container {
    position: static;
    transform: none;
    width: 100%;
    max-width: 560px;
    box-sizing: border-box;
  }

  .search-input {
    width: 100%;
  }
}
</style>
