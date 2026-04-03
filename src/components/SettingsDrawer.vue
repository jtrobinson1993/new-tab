<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { Icon } from '@iconify/vue'

export interface ChannelConfig {
  name: string
  platform: 'youtube' | 'twitch'
  handle: string
}

interface SavedLocation {
  name: string
  lat: number
  lon: number
}

const CHANNELS_KEY = 'streamer-channels'
const LOCATIONS_KEY = 'weather-locations'
const TEMP_UNIT_KEY = 'temperature-unit'

const DEFAULT_CHANNELS: ChannelConfig[] = [
  { name: 'WirtualTV', platform: 'youtube', handle: '@WirtualTV' },
  { name: 'Scrapie', platform: 'youtube', handle: '@Scrapie' },
  { name: 'Sodapoppin', platform: 'twitch', handle: 'sodapoppin' },
]

const open = ref(false)

const drawerEl = ref<HTMLElement | null>(null)
const settingsBtnEl = ref<HTMLElement | null>(null)

watch(open, (val) => {
  window.dispatchEvent(new CustomEvent('drawer-toggled', { detail: val }))
})

function onClickOutside(e: MouseEvent) {
  if (!open.value) return
  const target = e.target as Node
  if (drawerEl.value?.contains(target)) return
  if (settingsBtnEl.value?.contains(target)) return
  open.value = false
}

const channels = ref<ChannelConfig[]>([])
const platform = ref<'youtube' | 'twitch'>('twitch')
const handleInput = ref('')
const inputError = ref('')

const weatherLocations = ref<SavedLocation[]>([])
const locationInput = ref('')
const locationError = ref('')
const locationLoading = ref(false)
const tempUnit = ref<'C' | 'F'>(
  (localStorage.getItem(TEMP_UNIT_KEY) as 'C' | 'F') || 'C',
)

function setTempUnit(unit: 'C' | 'F') {
  tempUnit.value = unit
  localStorage.setItem(TEMP_UNIT_KEY, unit)
  window.dispatchEvent(new CustomEvent('temp-unit-changed'))
}

function loadChannels(): ChannelConfig[] {
  try {
    const raw = localStorage.getItem(CHANNELS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return DEFAULT_CHANNELS
}

function saveChannels() {
  localStorage.setItem(CHANNELS_KEY, JSON.stringify(channels.value))
  localStorage.removeItem('live-streamers')
  window.dispatchEvent(new CustomEvent('channels-updated'))
}

function loadWeatherLocations(): SavedLocation[] {
  try {
    const raw = localStorage.getItem(LOCATIONS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

function saveWeatherLocations() {
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(weatherLocations.value))
  window.dispatchEvent(new CustomEvent('locations-updated'))
}

function locationKey(loc: SavedLocation) {
  return `${loc.lat},${loc.lon}`
}

async function addWeatherLocation() {
  const query = locationInput.value.trim()
  if (!query) return

  locationError.value = ''
  locationLoading.value = true
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en`,
    )
    const data = await res.json()
    if (!data.results?.length) {
      locationError.value = 'Location not found'
      return
    }
    const r = data.results[0]
    const displayName = [r.name, r.admin1, r.country_code?.toUpperCase()]
      .filter(Boolean)
      .join(', ')
    const loc: SavedLocation = { name: displayName, lat: r.latitude, lon: r.longitude }

    if (weatherLocations.value.some((l) => locationKey(l) === locationKey(loc))) {
      locationError.value = 'Already added'
      return
    }

    weatherLocations.value.push(loc)
    saveWeatherLocations()
    locationInput.value = ''
  } catch {
    locationError.value = 'Location not found'
  } finally {
    locationLoading.value = false
  }
}

function removeWeatherLocation(index: number) {
  weatherLocations.value.splice(index, 1)
  saveWeatherLocations()
}

function addChannel() {
  const raw = handleInput.value.trim()
  if (!raw) return

  let handle = raw
  let detectedPlatform = platform.value
  let name = raw

  if (raw.includes('youtube.com/') || raw.includes('youtu.be/')) {
    detectedPlatform = 'youtube'
    const match = raw.match(/youtube\.com\/(@[\w-]+|channel\/[\w-]+)/)
    if (match?.[1]) {
      handle = match[1]
      name = handle.replace(/^@/, '')
    }
  } else if (raw.includes('twitch.tv/')) {
    detectedPlatform = 'twitch'
    const match = raw.match(/twitch\.tv\/([\w-]+)/)
    if (match?.[1]) {
      handle = match[1]
      name = handle
    }
  } else {
    if (detectedPlatform === 'youtube' && !raw.startsWith('@')) {
      handle = `@${raw}`
    }
    name = raw.replace(/^@/, '')
  }

  const exists = channels.value.some(
    (c) => c.handle.toLowerCase() === handle.toLowerCase() && c.platform === detectedPlatform,
  )
  if (exists) {
    inputError.value = 'Already added'
    return
  }

  channels.value.push({ name, platform: detectedPlatform, handle })
  saveChannels()
  handleInput.value = ''
  inputError.value = ''
}

function removeChannel(index: number) {
  channels.value.splice(index, 1)
  saveChannels()
}

onMounted(() => {
  channels.value = loadChannels()
  weatherLocations.value = loadWeatherLocations()
  if (!localStorage.getItem(CHANNELS_KEY)) {
    saveChannels()
  }
  document.addEventListener('mousedown', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
})
</script>

<template>
  <div>
    <button ref="settingsBtnEl" class="settings-btn" @click="open = !open" aria-label="Settings">
      <Icon icon="mdi:cog" width="20" height="20" />
    </button>

    <div ref="drawerEl" class="drawer" :class="{ open }">
      <div class="drawer-header">
        <h2>Settings</h2>
        <button class="close-btn" @click="open = false">
          <Icon icon="mdi:close" width="20" height="20" />
        </button>
      </div>

      <div class="drawer-content">
        <section class="section">
          <h3>Weather Locations</h3>
          <p class="section-hint">Add cities to show weather for.</p>

          <p class="section-hint">Temperature unit</p>
          <div class="platform-toggle temp-unit-margin">
            <button type="button" class="toggle-btn" :class="{ active: tempUnit === 'C' }" @click="setTempUnit('C')">°C</button>
            <button type="button" class="toggle-btn" :class="{ active: tempUnit === 'F' }" @click="setTempUnit('F')">°F</button>
          </div>

          <div class="channel-list">
            <div v-for="(loc, i) in weatherLocations" :key="locationKey(loc)" class="channel-item">
              <span class="location-name">{{ loc.name }}</span>
              <button class="channel-remove" @click="removeWeatherLocation(i)"><Icon icon="mdi:close" width="14" height="14" /></button>
            </div>
            <div v-if="weatherLocations.length === 0" class="empty-state">
              No locations added yet.
            </div>
          </div>

          <form class="add-form" @submit.prevent="addWeatherLocation">
            <input
              v-model="locationInput"
              type="text"
              placeholder="City, State or City, Country"
              class="channel-input"
              :disabled="locationLoading"
              @input="locationError = ''"
            />
            <p v-if="locationError" class="input-error">{{ locationError }}</p>
            <button type="submit" class="add-btn" :disabled="locationLoading">
              {{ locationLoading ? 'Searching...' : 'Add Location' }}
            </button>
          </form>
        </section>

        <hr class="section-divider" />

        <section class="section">
          <h3>Live Channels</h3>
          <p class="section-hint">Add YouTube or Twitch channels to monitor when they're live.</p>

          <div class="channel-list">
            <div v-for="(ch, i) in channels" :key="`${ch.platform}-${ch.handle}`" class="channel-item">
              <span class="channel-platform-badge" :class="ch.platform">
                {{ ch.platform === 'youtube' ? 'YT' : 'TW' }}
              </span>
              <span class="channel-name">{{ ch.name }}</span>
              <span class="channel-handle">{{ ch.handle }}</span>
              <button class="channel-remove" @click="removeChannel(i)"><Icon icon="mdi:close" width="14" height="14" /></button>
            </div>
            <div v-if="channels.length === 0" class="empty-state">
              No channels added yet.
            </div>
          </div>

          <form class="add-form" @submit.prevent="addChannel">
            <div class="platform-toggle">
              <button
                type="button"
                class="toggle-btn"
                :class="{ active: platform === 'twitch' }"
                @click="platform = 'twitch'"
              >
                Twitch
              </button>
              <button
                type="button"
                class="toggle-btn"
                :class="{ active: platform === 'youtube' }"
                @click="platform = 'youtube'"
              >
                YouTube
              </button>
            </div>
            <input
              v-model="handleInput"
              type="text"
              :placeholder="platform === 'twitch' ? 'username or twitch.tv/...' : '@handle or youtube.com/...'"
              class="channel-input"
              @input="inputError = ''"
            />
            <p v-if="inputError" class="input-error">{{ inputError }}</p>
            <button type="submit" class="add-btn">Add Channel</button>
          </form>
        </section>
      </div>
    </div>
  </div>
</template>

<style>
.settings-btn {
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #777;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s, background 0.2s;
  z-index: 100;
}

.settings-btn:hover {
  color: #e0e0e0;
  background: rgba(0, 0, 0, 0.5);
}

.drawer {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 380px;
  max-width: 90vw;
  z-index: 1000;
  background: rgba(20, 20, 30, 0.8);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
  color: #e0e0e0;
  overflow-y: auto;
  transform: translateX(-100%);
  transition: transform 0.3s ease;
}

.drawer.open {
  transform: translateX(0);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.drawer-header h2 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #777;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #e0e0e0;
}

.drawer-content {
  padding: 20px 24px;
  flex: 1;
}

.section h3 {
  margin: 0 0 4px;
  font-size: 0.95rem;
  font-weight: 600;
  color: #ccc;
}

.section-hint {
  margin: 0 0 16px;
  font-size: 0.8rem;
  color: #777;
}

.section-divider {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin: 24px 0;
}

.channel-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.channel-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
}

.location-name {
  font-size: 0.9rem;
  font-weight: 500;
  flex: 1;
}

.channel-platform-badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.channel-platform-badge.twitch {
  background: rgba(145, 70, 255, 0.25);
  color: #b9a3e3;
}

.channel-platform-badge.youtube {
  background: rgba(255, 0, 0, 0.2);
  color: #e88;
}

.channel-name {
  font-size: 0.9rem;
  font-weight: 500;
}

.channel-handle {
  font-size: 0.75rem;
  color: #666;
  margin-left: auto;
}

.channel-remove {
  background: none;
  border: none;
  color: #555;
  cursor: pointer;
  padding: 0 2px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.channel-remove:hover {
  color: #e53935;
}

.empty-state {
  font-size: 0.85rem;
  color: #555;
  padding: 12px 0;
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.platform-toggle {
  display: flex;
  gap: 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.toggle-btn {
  flex: 1;
  padding: 6px 0;
  background: transparent;
  border: none;
  color: #777;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.toggle-btn.active {
  background: rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
}

.toggle-btn:hover:not(.active) {
  color: #aaa;
}

.channel-input {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 0.9rem;
  padding: 8px 12px;
  outline: none;
}

.channel-input::placeholder {
  color: #555;
}

.channel-input:focus {
  border-color: rgba(255, 255, 255, 0.3);
}

.input-error {
  margin: 0;
  font-size: 0.8rem;
  color: #e53935;
}

.add-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: #ccc;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.add-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.temp-unit-margin {
  margin-bottom: 20px;
}
</style>
