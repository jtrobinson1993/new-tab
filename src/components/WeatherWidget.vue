<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
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

function onLocationsUpdated() {
  const oldKeys = new Set(locations.value.map(locationKey))
  loadLocations()
  const newKeys = new Set(locations.value.map(locationKey))

  // Clean up removed locations
  for (const key of oldKeys) {
    if (!newKeys.has(key)) {
      localStorage.removeItem(WEATHER_KEY_PREFIX + key)
      weatherResults.value.delete(key)
    }
  }

  // Fetch weather for new locations
  for (const loc of locations.value) {
    if (!oldKeys.has(locationKey(loc))) {
      fetchWeatherForLocation(loc)
    }
  }
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
  locations.value.forEach(fetchWeatherForLocation)
  window.addEventListener('locations-updated', onLocationsUpdated)
})

onUnmounted(() => {
  window.removeEventListener('locations-updated', onLocationsUpdated)
})
</script>

<template>
  <div class="weather-container">
    <GlassCard v-for="item in items" :key="locationKey(item.location)" class="weather-card">
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

  </div>
</template>

<style scoped>

.weather-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 24px;
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

</style>

<style>
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

@container main (max-width: 1280px) {
  .weather-container {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    width: 100%;
  }

  .weather-card {
    flex: 0 1 auto;
    box-sizing: border-box;
  }
}
</style>
