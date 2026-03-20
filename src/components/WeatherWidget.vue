<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import GlassCard from './GlassCard.vue'
import { getCached, setCache } from '@/utils/cache'

interface SavedLocation {
  name: string
  lat: number
  lon: number
}

interface WeatherData {
  temperature: number
  weatherCode: number
  isDay: boolean
}

interface LocationWeather {
  location: SavedLocation
  weather: WeatherData | null
  loading: boolean
  error: string
}

const LOCATIONS_KEY = 'weather-locations'
const WEATHER_KEY_PREFIX = 'weather-'

const weatherMap: Record<number, { description: string; icon: string; iconNight?: string }> = {
  0: { description: 'Clear sky', icon: 'clear-day', iconNight: 'clear-night' },
  1: { description: 'Mainly clear', icon: 'clear-day', iconNight: 'clear-night' },
  2: { description: 'Partly cloudy', icon: 'partly-cloudy-day', iconNight: 'partly-cloudy-night' },
  3: { description: 'Overcast', icon: 'overcast' },
  45: { description: 'Fog', icon: 'fog' },
  48: { description: 'Depositing rime fog', icon: 'fog' },
  51: { description: 'Light drizzle', icon: 'drizzle' },
  53: { description: 'Moderate drizzle', icon: 'drizzle' },
  55: { description: 'Dense drizzle', icon: 'drizzle' },
  56: { description: 'Light freezing drizzle', icon: 'sleet' },
  57: { description: 'Dense freezing drizzle', icon: 'sleet' },
  61: { description: 'Slight rain', icon: 'rain' },
  63: { description: 'Moderate rain', icon: 'rain' },
  65: { description: 'Heavy rain', icon: 'rain' },
  66: { description: 'Light freezing rain', icon: 'sleet' },
  67: { description: 'Heavy freezing rain', icon: 'sleet' },
  71: { description: 'Slight snowfall', icon: 'snow' },
  73: { description: 'Moderate snowfall', icon: 'snow' },
  75: { description: 'Heavy snowfall', icon: 'snow' },
  77: { description: 'Snow grains', icon: 'snow' },
  80: { description: 'Slight rain showers', icon: 'rain' },
  81: { description: 'Moderate rain showers', icon: 'rain' },
  82: { description: 'Violent rain showers', icon: 'extreme-rain' },
  85: { description: 'Slight snow showers', icon: 'snow' },
  86: { description: 'Heavy snow showers', icon: 'snow' },
  95: { description: 'Thunderstorm', icon: 'thunderstorms' },
  96: { description: 'Thunderstorm with slight hail', icon: 'thunderstorms' },
  99: { description: 'Thunderstorm with heavy hail', icon: 'thunderstorms' },
}

function getWeatherInfo(code: number, isDay: boolean) {
  const entry = weatherMap[code] ?? { description: 'Unknown', icon: 'cloudy' }
  const icon = !isDay && entry.iconNight ? entry.iconNight : entry.icon
  return {
    description: entry.description,
    iconUrl: `https://bmcdn.nl/assets/weather-icons/v3.0/fill/svg/${icon}.svg`,
  }
}

const locations = ref<SavedLocation[]>([])
const weatherResults = ref<Map<string, { weather: WeatherData | null; loading: boolean; error: string }>>(new Map())
const showInput = ref(false)
const inputValue = ref('')
const inputError = ref('')
const inputLoading = ref(false)

function locationKey(loc: SavedLocation) {
  return `${loc.lat},${loc.lon}`
}

function loadLocations() {
  try {
    const raw = localStorage.getItem(LOCATIONS_KEY)
    if (raw) locations.value = JSON.parse(raw)
  } catch { /* ignore */ }
}

function saveLocations() {
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations.value))
}

async function fetchWeatherForLocation(loc: SavedLocation) {
  const key = locationKey(loc)
  const cacheKey = WEATHER_KEY_PREFIX + key

  const cached = getCached<WeatherData>(cacheKey)
  if (cached) {
    weatherResults.value.set(key, { weather: cached, loading: false, error: '' })
    return
  }

  weatherResults.value.set(key, { weather: null, loading: true, error: '' })
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code,is_day&temperature_unit=fahrenheit`
    const res = await fetch(url)
    const data = await res.json()
    const weather: WeatherData = {
      temperature: Math.round(data.current.temperature_2m),
      weatherCode: data.current.weather_code,
      isDay: data.current.is_day === 1,
    }
    setCache(cacheKey, weather)
    weatherResults.value.set(key, { weather, loading: false, error: '' })
  } catch {
    weatherResults.value.set(key, { weather: null, loading: false, error: 'Failed to fetch' })
  }
}

async function geocodeCity(name: string): Promise<SavedLocation> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en`,
  )
  const data = await res.json()
  if (!data.results?.length) throw new Error('Location not found')
  const r = data.results[0]
  const displayName = [r.name, r.admin1, r.country_code?.toUpperCase()]
    .filter(Boolean)
    .join(', ')
  return { name: displayName, lat: r.latitude, lon: r.longitude }
}

async function addLocation() {
  const query = inputValue.value.trim()
  if (!query) return

  inputError.value = ''
  inputLoading.value = true
  try {
    const loc = await geocodeCity(query)
    const exists = locations.value.some((l) => locationKey(l) === locationKey(loc))
    if (exists) {
      inputError.value = 'Already added'
      return
    }
    locations.value.push(loc)
    saveLocations()
    fetchWeatherForLocation(loc)
    inputValue.value = ''
    showInput.value = false
  } catch {
    inputError.value = 'Location not found'
  } finally {
    inputLoading.value = false
  }
}

function removeLocation(index: number) {
  const loc = locations.value[index]
  const key = locationKey(loc)
  localStorage.removeItem(WEATHER_KEY_PREFIX + key)
  weatherResults.value.delete(key)
  locations.value.splice(index, 1)
  saveLocations()
}

const items = computed<LocationWeather[]>(() =>
  locations.value.map((loc) => {
    const result = weatherResults.value.get(locationKey(loc))
    return {
      location: loc,
      weather: result?.weather ?? null,
      loading: result?.loading ?? true,
      error: result?.error ?? '',
    }
  }),
)

const hasLocations = computed(() => locations.value.length > 0)

onMounted(() => {
  loadLocations()
  if (locations.value.length === 0) {
    showInput.value = true
  }
  locations.value.forEach(fetchWeatherForLocation)
})
</script>

<template>
  <div class="weather-container">
    <GlassCard v-for="(item, i) in items" :key="locationKey(item.location)" class="weather-card">
      <button class="remove-btn" @click="removeLocation(i)">&times;</button>
      <div v-if="item.loading" class="loading">
        <svg class="spinner" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
      <div v-else-if="item.error" class="error">{{ item.error }}</div>
      <template v-else-if="item.weather">
        <p class="city">{{ item.location.name }}</p>
        <div class="weather-main">
          <img
            :src="getWeatherInfo(item.weather.weatherCode, item.weather.isDay).iconUrl"
            :alt="getWeatherInfo(item.weather.weatherCode, item.weather.isDay).description"
            class="weather-icon"
          />
          <span class="temperature">{{ item.weather.temperature }}°F</span>
        </div>
        <p class="description">{{ getWeatherInfo(item.weather.weatherCode, item.weather.isDay).description }}</p>
      </template>
    </GlassCard>

    <GlassCard v-if="showInput" class="weather-card input-card">
      <form @submit.prevent="addLocation">
        <input
          v-model="inputValue"
          type="text"
          placeholder="City, State or City, Country"
          class="location-input"
          :disabled="inputLoading"
        />
        <p v-if="inputError" class="input-error">{{ inputError }}</p>
      </form>
    </GlassCard>

    <button v-if="!showInput" class="add-btn" @click="showInput = true">+</button>
  </div>
</template>

<style scoped>
.weather-container {
  position: fixed;
  top: 20px;
  left: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family: system-ui, -apple-system, sans-serif;
  color: #e0e0e0;
}

.weather-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 24px;
}

.remove-btn {
  position: absolute;
  top: 6px;
  right: 10px;
  background: none;
  border: none;
  color: #777;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.15s;
}

.weather-card:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  color: #e53935;
}

.city {
  margin: 0 0 2px 0;
  font-size: 1.1rem;
  font-weight: 500;
  color: #ccc;
  letter-spacing: 0.02em;
}

.weather-main {
  display: flex;
  align-items: center;
  gap: 4px;
}

.weather-icon {
  width: 90px;
  height: 90px;
}

.temperature {
  font-size: 2.8rem;
  font-weight: 300;
}

.description {
  margin: 0;
  font-size: 1.2rem;
  color: #aaa;
}

.loading {
  color: #aaa;
}

.spinner {
  width: 36px;
  height: 36px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error {
  font-size: 0.95rem;
  color: #aaa;
}

.input-card {
  padding: 12px 16px;
}

.location-input {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #e0e0e0;
  font-size: 0.95rem;
  padding: 8px 12px;
  width: 220px;
  outline: none;
}

.location-input::placeholder {
  color: #777;
}

.location-input:focus {
  border-color: rgba(255, 255, 255, 0.4);
}

.input-error {
  margin: 4px 0 0;
  font-size: 0.8rem;
  color: #e53935;
}

.add-btn {
  align-self: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #999;
  font-size: 1.4rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
}

.add-btn:hover {
  color: #e0e0e0;
}
</style>
