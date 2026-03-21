<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import GlassCard from './GlassCard.vue'
import { getCached, setCache } from '@/utils/cache'

interface SavedLocation {
  name: string
  lat: number
  lon: number
}

interface ForecastDay {
  date: string
  dayName: string
  weatherCode: number
  tempHigh: number
  tempLow: number
  precipChance: number
  precipAmount: number
}

interface WeatherData {
  temperature: number
  weatherCode: number
  isDay: boolean
  todayHigh: number
  todayLow: number
  todayPrecipChance: number
  todayPrecipAmount: number
  todayWeatherCode: number
  forecast: ForecastDay[]
}

interface LocationWeather {
  location: SavedLocation
  weather: WeatherData | null
  loading: boolean
  error: string
}

const LOCATIONS_KEY = 'weather-locations'
const TEMP_UNIT_KEY = 'temperature-unit'
const WEATHER_KEY_PREFIX = 'weather-'

const tempUnit = ref<'C' | 'F'>(
  (localStorage.getItem(TEMP_UNIT_KEY) as 'C' | 'F') || 'C',
)

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
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&temperature_unit=fahrenheit&forecast_days=7`
    const res = await fetch(url)
    const data = await res.json()
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const forecast: ForecastDay[] = (data.daily.time as string[]).slice(1).map((date: string, i: number) => {
      const idx = i + 1
      const d = new Date(date + 'T00:00:00')
      return {
        date,
        dayName: dayNames[d.getDay()]!,
        weatherCode: data.daily.weather_code[idx],
        tempHigh: Math.round(data.daily.temperature_2m_max[idx]),
        tempLow: Math.round(data.daily.temperature_2m_min[idx]),
        precipChance: Math.round(data.daily.precipitation_probability_max[idx]),
        precipAmount: data.daily.precipitation_sum[idx],
      }
    })
    const weather: WeatherData = {
      temperature: Math.round(data.current.temperature_2m),
      weatherCode: data.current.weather_code,
      isDay: data.current.is_day === 1,
      todayHigh: Math.round(data.daily.temperature_2m_max[0]),
      todayLow: Math.round(data.daily.temperature_2m_min[0]),
      todayPrecipChance: Math.round(data.daily.precipitation_probability_max[0]),
      todayPrecipAmount: data.daily.precipitation_sum[0],
      todayWeatherCode: data.daily.weather_code[0],
      forecast,
    }
    setCache(cacheKey, weather)
    weatherResults.value.set(key, { weather, loading: false, error: '' })
  } catch {
    weatherResults.value.set(key, { weather: null, loading: false, error: 'Failed to fetch' })
  }
}

function onTempUnitChanged() {
  tempUnit.value = (localStorage.getItem(TEMP_UNIT_KEY) as 'C' | 'F') || 'C'
}

function popoverId(loc: SavedLocation): string {
  return 'forecast-' + locationKey(loc).replace(',', '-')
}

function toggleForecast(loc: SavedLocation) {
  const el = document.getElementById(popoverId(loc))
  if (el) el.togglePopover()
}

const NON_PRECIP_CODES = new Set([0, 1, 2, 3, 45, 48])

function precipAwareIcon(code: number, precipChance: number, tempLow: number): string {
  // If high precip chance but weather code doesn't show precipitation, override
  if (precipChance >= 40 && NON_PRECIP_CODES.has(code)) {
    const icon = tempLow <= 32 ? 'snow' : 'rain'
    return `https://bmcdn.nl/assets/weather-icons/v3.0/fill/svg/${icon}.svg`
  }
  const entry = weatherMap[code] ?? { icon: 'cloudy' }
  return `https://bmcdn.nl/assets/weather-icons/v3.0/fill/svg/${entry.icon}.svg`
}

function forecastIconUrl(code: number): string {
  const entry = weatherMap[code] ?? { icon: 'cloudy' }
  return `https://bmcdn.nl/assets/weather-icons/v3.0/fill/svg/${entry.icon}.svg`
}

function displayTemp(f: number): number {
  if (tempUnit.value === 'C') return Math.round((f - 32) * 5 / 9)
  return f
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
  window.addEventListener('temp-unit-changed', onTempUnitChanged)
})

onUnmounted(() => {
  window.removeEventListener('locations-updated', onLocationsUpdated)
  window.removeEventListener('temp-unit-changed', onTempUnitChanged)
})
</script>

<template>
  <div class="weather-container">
    <GlassCard
      v-for="item in items"
      :key="locationKey(item.location)"
      class="weather-card"
      @click="toggleForecast(item.location)"
    >
      <div v-if="item.loading" class="loading">
        <svg class="spinner" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </div>
      <div v-else-if="item.error" class="error">{{ item.error }}</div>
      <template v-else-if="item.weather">
        <p class="city">{{ item.location.name }}</p>
        <div class="weather-body">
          <div class="weather-left">
            <div class="weather-main">
              <img
                :src="getWeatherInfo(item.weather.weatherCode, item.weather.isDay).iconUrl"
                :alt="getWeatherInfo(item.weather.weatherCode, item.weather.isDay).description"
                class="weather-icon"
              />
              <span class="temperature">{{ displayTemp(item.weather.temperature) }}°{{ tempUnit }}</span>
            </div>
            <p class="description">{{ getWeatherInfo(item.weather.weatherCode, item.weather.isDay).description }}</p>
          </div>
          <div class="weather-divider" />
          <div class="weather-right">
            <div class="today-temps">
              <span class="today-low">{{ displayTemp(item.weather.todayLow) }}°</span>
              <span class="today-sep">/</span>
              <span class="today-high">{{ displayTemp(item.weather.todayHigh) }}°</span>
            </div>
            <div class="right-divider" />
            <div class="today-conditions">
              <img :src="precipAwareIcon(item.weather.todayWeatherCode, item.weather.todayPrecipChance, item.weather.todayLow)" :alt="weatherMap[item.weather.todayWeatherCode]?.description" class="today-conditions-icon" />
              <span class="today-precip-chance">{{ item.weather.todayPrecipChance }}%</span>
            </div>
          </div>
        </div>
      </template>

      <div
        v-if="item.weather?.forecast"
        :id="popoverId(item.location)"
        popover
        class="forecast-popover"
      >
        <h3 class="forecast-title">{{ item.location.name }} — 6-Day Forecast</h3>
        <div class="forecast-days">
          <div v-for="day in item.weather.forecast" :key="day.date" class="forecast-day">
            <span class="forecast-day-name">{{ day.dayName }}</span>
            <img :src="precipAwareIcon(day.weatherCode, day.precipChance, day.tempLow)" :alt="weatherMap[day.weatherCode]?.description" class="forecast-icon" />
            <span class="forecast-temps">
              <span class="forecast-low">{{ displayTemp(day.tempLow) }}°</span>
              <span class="forecast-sep">/</span>
              <span class="forecast-high">{{ displayTemp(day.tempHigh) }}°</span>
            </span>
            <span v-if="day.precipChance > 0" class="forecast-precip">
              {{ day.precipChance }}%
              <span v-if="day.precipAmount > 0" class="forecast-precip-amount">{{ day.precipAmount }}mm</span>
            </span>
          </div>
        </div>
      </div>
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
  cursor: pointer;
  transition: background 0.15s;
}

.weather-card:hover {
  background: rgba(0, 0, 0, 0.23);
}

.city {
  margin: 0 0 8px 0;
  font-size: 1.1rem;
  font-weight: 500;
  color: #e0e0e0;
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

.weather-body {
  display: flex;
  align-items: center;
  gap: 16px;
}

.weather-left {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.description {
  margin: 0;
  font-size: 1rem;
  color: #e0e0e0;
}

.weather-divider {
  width: 1px;
  align-self: stretch;
  background: rgba(255, 255, 255, 0.2);
  margin: 4px 6px;
}

.weather-right {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.today-temps {
  font-size: 1.05rem;
  display: flex;
  align-items: center;
  gap: 3px;
  margin-bottom: 2px;
}

.today-high {
  font-weight: 600;
  color: #ffcdc9;
}

.today-sep {
  color: rgba(255, 255, 255, 0.2);
}

.today-low {
  font-weight: 500;
  color: #c0d8f0;
}

.right-divider {
  width: 100%;
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
}

.today-conditions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.today-conditions-icon {
  width: 36px;
  height: 36px;
}

.today-precip-chance {
  font-size: 0.8rem;
  color: #e0e0e0;
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

.forecast-popover {
  background: rgba(20, 20, 30, 0.8);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 24px 28px;
  color: #e0e0e0;
  font-family: system-ui, -apple-system, sans-serif;
  width: fit-content;
  max-width: 90vw;
  margin: auto;
}

.forecast-popover::backdrop {
  background: rgba(0, 0, 0, 0.3);
}

.forecast-title {
  margin: 0 0 16px;
  font-size: 1.1rem;
  font-weight: 600;
  color: #ccc;
}

.forecast-days {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 32px;
}

.forecast-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
}

.forecast-day-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: #e0e0e0;
}

.forecast-icon {
  width: 60px;
  height: 60px;
}

.forecast-temps {
  display: flex;
  gap: 4px;
  font-size: 0.95rem;
}

.forecast-sep {
  color: rgba(255, 255, 255, 0.2);
}

.forecast-high {
  font-weight: 600;
  color: #ffcdc9;
}

.forecast-low {
  font-weight: 500;
  color: #c0d8f0;
}

.forecast-precip {
  font-size: 0.8rem;
  color: #6ab0f3;
  display: flex;
  gap: 3px;
}

.forecast-precip-amount {
  color: #5590c4;
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
