<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import WeatherWidget from './components/WeatherWidget.vue'
import LiveStreamers from './components/LiveStreamers.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import SearchBar from './components/SearchBar.vue'
import { getCached, setCache } from '@/utils/cache'
import { PROXY_BASE } from '@/utils/api'

const SUBREDDITS_KEY = 'background-subreddits'
const bgUrl = ref('')
const drawerOpen = ref(false)

function onDrawerToggle(e: Event) {
  drawerOpen.value = (e as CustomEvent).detail
}

function getSubreddits(): string[] {
  try {
    const raw = localStorage.getItem(SUBREDDITS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

async function fetchBackground() {
  const subreddits = getSubreddits()
  if (subreddits.length === 0) {
    bgUrl.value = ''
    return
  }

  const cached = getCached<string>('background')
  if (cached) {
    bgUrl.value = cached
    return
  }

  try {
    const pick = subreddits[Math.floor(Math.random() * subreddits.length)]
    const res = await fetch(
      `${PROXY_BASE}/reddit-api/r/${pick}/top.json?t=week&limit=50&raw_json=1`,
    )
    const data = await res.json()
    const posts = data.data.children
      .map((c: any) => c.data)
      .filter(
        (p: any) =>
          !p.is_video &&
          !p.is_self &&
          p.url &&
          /\.(jpg|jpeg|png)(\?.*)?$/i.test(p.url),
      )
    if (posts.length > 0) {
      const img = posts[Math.floor(Math.random() * posts.length)]
      bgUrl.value = img.url
      setCache('background', img.url)
    }
  } catch {
    // Background is non-critical, silently fail
  }
}

function onSubredditsUpdated() {
  bgUrl.value = ''
  fetchBackground()
}

onMounted(() => {
  fetchBackground()
  window.addEventListener('subreddits-updated', onSubredditsUpdated)
  window.addEventListener('drawer-toggled', onDrawerToggle)
})

onUnmounted(() => {
  window.removeEventListener('subreddits-updated', onSubredditsUpdated)
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
