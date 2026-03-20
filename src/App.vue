<script setup lang="ts">
import { ref, onMounted } from 'vue'
import WeatherWidget from './components/WeatherWidget.vue'
import LiveStreamers from './components/LiveStreamers.vue'
import { getCached, setCache } from '@/utils/cache'
import { PROXY_BASE } from '@/utils/api'

const bgUrl = ref('')

onMounted(async () => {
  const cached = getCached<string>('background')
  if (cached) {
    bgUrl.value = cached
    return
  }

  try {
    const res = await fetch(
      `${PROXY_BASE}/reddit-api/r/EarthPorn/top.json?t=week&limit=50&raw_json=1`,
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
      const pick = posts[Math.floor(Math.random() * posts.length)]
      bgUrl.value = pick.url
      setCache('background', pick.url)
    }
  } catch {
    // Background is non-critical, silently fail
  }
})
</script>

<template>
  <div class="background" :style="bgUrl ? { backgroundImage: `url(${bgUrl})` } : {}"></div>
  <WeatherWidget />
  <LiveStreamers />
</template>

<style scoped>
.background {
  position: fixed;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-color: #1a1a2e;
  z-index: -1;
}
</style>
