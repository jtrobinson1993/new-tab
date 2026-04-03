<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import WeatherWidget from './components/WeatherWidget.vue'
import LiveStreamers from './components/LiveStreamers.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import SearchBar from './components/SearchBar.vue'
import { getCachedBackground, getCachedImageCount, cacheImage } from '@/utils/imageCache'

const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY
const bgUrl = ref('')
const drawerOpen = ref(false)

function onDrawerToggle(e: Event) {
  drawerOpen.value = (e as CustomEvent).detail
}

async function fetchBackground() {
  try {
    const cachedCount = await getCachedImageCount()

    if (cachedCount >= 6) {
      const cached = await getCachedBackground()
      if (cached) {
        bgUrl.value = cached
        return
      }
    }

    const res = await fetch(
      'https://api.unsplash.com/photos/random?orientation=landscape&query=nature+landscape&w=1920',
      { headers: { 'Authorization': `Client-ID ${UNSPLASH_KEY}` } },
    )
    if (!res.ok) {
      // Fall back to cached image if available
      const cached = await getCachedBackground()
      if (cached) bgUrl.value = cached
      return
    }

    const data = await res.json()
    const imageUrl = data.urls.full
    bgUrl.value = await cacheImage(imageUrl)
  } catch {
    // Fall back to cached image on error
    const cached = await getCachedBackground()
    if (cached) bgUrl.value = cached
  }
}

onMounted(() => {
  fetchBackground()
  window.addEventListener('drawer-toggled', onDrawerToggle)
})

onUnmounted(() => {
  window.removeEventListener('drawer-toggled', onDrawerToggle)
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
