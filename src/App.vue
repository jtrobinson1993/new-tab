<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import WeatherWidget from './components/WeatherWidget.vue'
import LiveStreamers from './components/LiveStreamers.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import SearchBar from './components/SearchBar.vue'
import { getCachedBackground, getCachedImageCount, cacheImage, clearCache } from '@/utils/imageCache'

const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY
const BG_KEYWORDS_KEY = 'background-keywords'
const bgUrl = ref('')
const drawerOpen = ref(false)
let fetchController: AbortController | null = null

function onDrawerToggle(e: Event) {
  drawerOpen.value = (e as CustomEvent).detail
}

async function fetchBackground() {
  if (fetchController) fetchController.abort()
  fetchController = new AbortController()
  const { signal } = fetchController

  try {
    const cachedCount = await getCachedImageCount()

    if (cachedCount >= 6) {
      const cached = await getCachedBackground()
      if (cached) {
        bgUrl.value = cached
        return
      }
    }

    let query = 'nature landscape'
    try {
      const raw = localStorage.getItem(BG_KEYWORDS_KEY)
      if (raw) {
        const keywords: string[] = JSON.parse(raw)
        if (keywords.length > 0) {
          query = keywords[Math.floor(Math.random() * keywords.length)]!
        }
      }
    } catch { /* ignore */ }

    const res = await fetch(
      `https://api.unsplash.com/photos/random?orientation=landscape&query=${encodeURIComponent(query)}&w=1920`,
      { headers: { 'Authorization': `Client-ID ${UNSPLASH_KEY}` }, signal },
    )
    if (!res.ok) {
      const cached = await getCachedBackground()
      if (cached) bgUrl.value = cached
      return
    }

    const data = await res.json()
    const imageUrl = data.urls.full
    bgUrl.value = await cacheImage(imageUrl)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    const cached = await getCachedBackground()
    if (cached) bgUrl.value = cached
  }
}

async function onBgKeywordsUpdated() {
  await clearCache()
  bgUrl.value = ''
  await fetchBackground()
}

onMounted(() => {
  fetchBackground()
  window.addEventListener('drawer-toggled', onDrawerToggle)
  window.addEventListener('bg-keywords-updated', onBgKeywordsUpdated)
})

onUnmounted(() => {
  window.removeEventListener('drawer-toggled', onDrawerToggle)
  window.removeEventListener('bg-keywords-updated', onBgKeywordsUpdated)
})
</script>

<template>
  <div class="background" :style="bgUrl ? { backgroundImage: `url(${bgUrl})` } : {}"></div>
  <div class="page-wrapper" :class="{ 'drawer-open': drawerOpen }">
    <div class="main-content">
      <SearchBar />
      <WeatherWidget />
      <LiveStreamers />
    </div>
  </div>
  <SettingsDrawer />
</template>

<style>
.background {
  position: fixed;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-color: #1a1a2e;
  z-index: -1;
}

.page-wrapper {
  container-type: inline-size;
  container-name: main;
  transition: margin-left 0.3s ease;
  min-height: 100dvh;
}

.page-wrapper.drawer-open {
  margin-left: 380px;
}

@container main (max-width: 1280px) {
  .main-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 24px 16px 80px;
    min-height: 100dvh;
  }
}
</style>
