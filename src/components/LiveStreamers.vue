<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useQuery } from '@pinia/colada'
import GlassCard from './GlassCard.vue'
import { getCached, setCache } from '@/utils/cache'
import { PROXY_BASE } from '@/utils/api'
import type { ChannelConfig } from './SettingsDrawer.vue'

const CHANNELS_KEY = 'streamer-channels'

interface LiveStream {
  name: string
  platform: 'youtube' | 'twitch'
  handle: string
  title?: string
  viewers?: number
}

const streamers = ref<ChannelConfig[]>([])

function loadChannels() {
  try {
    const raw = localStorage.getItem(CHANNELS_KEY)
    if (raw) streamers.value = JSON.parse(raw)
  } catch { /* ignore */ }
}

function onChannelsUpdated() {
  loadChannels()
  refetch()
}

onMounted(() => {
  loadChannels()
  window.addEventListener('channels-updated', onChannelsUpdated)
})

onUnmounted(() => {
  window.removeEventListener('channels-updated', onChannelsUpdated)
})

async function checkYouTubeLive(handle: string): Promise<{ live: boolean; title?: string }> {
  const res = await fetch(`${PROXY_BASE}/yt-api/${handle}/live`)
  const html = await res.text()
  const isLive = html.includes('"isLive":true')
  let title: string | undefined
  if (isLive) {
    const match = html.match(/"title":"(.*?)"/)
    if (match) title = match[1]
  }
  return { live: isLive, title }
}

async function checkTwitchLive(
  login: string,
): Promise<{ live: boolean; title?: string; viewers?: number }> {
  const res = await fetch(`${PROXY_BASE}/twitch-gql/gql`, {
    method: 'POST',
    headers: {
      'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `query { user(login: "${login}") { stream { title viewersCount } } }`,
    }),
  })
  const data = await res.json()
  const stream = data?.data?.user?.stream
  if (!stream) return { live: false }
  return { live: true, title: stream.title, viewers: stream.viewersCount }
}

const SIMULATE_LIVE = false

const { data: liveStreams, refetch } = useQuery({
  key: ['live-streamers'],
  query: async (): Promise<LiveStream[]> => {
    if (streamers.value.length === 0) return []

    if (SIMULATE_LIVE) {
      return streamers.value.map((s) => ({
        ...s,
        title: s.platform === 'twitch' ? 'Just chatting with the boys' : 'Trackmania COTD Grind',
        viewers: s.platform === 'twitch' ? 24312 : undefined,
      }))
    }

    const cached = getCached<LiveStream[]>('live-streamers')
    if (cached) return cached

    const results = await Promise.allSettled(
      streamers.value.map(async (s) => {
        if (s.platform === 'youtube') {
          const result = await checkYouTubeLive(s.handle)
          if (!result.live) return null
          return { ...s, title: result.title } as LiveStream
        } else {
          const result = await checkTwitchLive(s.handle)
          if (!result.live) return null
          return { ...s, title: result.title, viewers: result.viewers } as LiveStream
        }
      }),
    )
    const live = results
      .filter((r): r is PromiseFulfilledResult<LiveStream | null> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((r): r is LiveStream => r !== null)
    setCache('live-streamers', live)
    return live
  },
  staleTime: 10 * 60 * 1000,
})

const hasLive = computed(() => (liveStreams.value?.length ?? 0) > 0)

function streamUrl(stream: LiveStream) {
  if (stream.platform === 'youtube') {
    return `https://www.youtube.com/${stream.handle}/live`
  }
  return `https://www.twitch.tv/${stream.handle}`
}

function platformLabel(platform: 'youtube' | 'twitch') {
  return platform === 'youtube' ? 'YouTube' : 'Twitch'
}
</script>

<template>
  <GlassCard v-if="hasLive" class="live-widget">
    <div v-for="stream in liveStreams" :key="stream.handle" class="stream">
      <a :href="streamUrl(stream)" target="_blank" rel="noopener" class="stream-link">
        <span class="live-dot" />
        <span class="stream-name">{{ stream.name }}</span>
        <span class="stream-platform">{{ platformLabel(stream.platform) }}</span>
      </a>
      <p v-if="stream.title" class="stream-title">{{ stream.title }}</p>
    </div>
  </GlassCard>
</template>

<style scoped>
.live-widget {
  position: fixed;
  top: 20px;
  right: 20px;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, sans-serif;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stream-link {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: #e0e0e0;
}

.stream-link:hover .stream-name {
  text-decoration: underline;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e53935;
  flex-shrink: 0;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.stream-name {
  font-size: 0.95rem;
  font-weight: 600;
}

.stream-platform {
  font-size: 0.75rem;
  color: #999;
}

.stream-title {
  margin: 2px 0 0 16px;
  font-size: 0.75rem;
  color: #aaa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
}

</style>

<style>
@container main (max-width: 1280px) {
  .live-widget {
    position: static;
    width: 100%;
    box-sizing: border-box;
  }
}
</style>
