<template>
  <div class="progress-chart">
    <div class="chart-header card">
      <h2>Progress Chart</h2>
      <p class="chart-description">Daily chord transition time improvements</p>
    </div>

    <div class="chart-container card">
      <div v-if="loading" class="loading-message">Loading chart data...</div>
      <div v-else-if="error" class="error-message">{{ error }}</div>
      <div v-else-if="!hasData" class="empty-message">
        No practice data yet. Start practicing to see your progress!
      </div>
      <div v-else ref="chartRef" class="chart"></div>
    </div>

    <div v-if="hasData" class="legend-container card">
      <h3>Chord Legend</h3>
      <div class="legend-items">
        <div
          v-for="chord in chordNames"
          :key="chord"
          class="legend-item"
        >
          <div
            class="legend-color"
            :style="{ backgroundColor: getChordColor(chord) }"
          ></div>
          <span>{{ chord }}</span>
        </div>
      </div>
    </div>

    <div v-if="hasData" class="daily-averages-container card">
      <h3>Daily Averages</h3>
      <div class="daily-averages-list">
        <div
          v-for="day in dailyAverages"
          :key="day.date"
          class="daily-average-item"
        >
          <div class="date-header">{{ day.date }}</div>
          <div class="averages-grid">
            <div
              v-for="avg in day.averages"
              :key="avg.chord"
              class="chord-average"
            >
              <span class="chord-name">{{ avg.chord }}:</span>
              <span class="chord-time">{{ avg.time.toFixed(2) }}s</span>
            </div>
          </div>
          <div class="overall-average">
            Overall: {{ day.overallAverage.toFixed(2) }}s
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import * as d3 from 'd3'
import { getAllProgress, type DailyProgress } from '../db/practiceDb'

const chartRef = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const progressData = ref<DailyProgress[]>([])
const chordNames = ref<string[]>([])

const hasData = computed(() => progressData.value.length > 0)

// Calculate daily averages for display
interface DailyAverage {
  date: string
  averages: { chord: string; time: number }[]
  overallAverage: number
}

const dailyAverages = computed((): DailyAverage[] => {
  return progressData.value
    .map(dailyData => {
      const chordTimes = new Map<string, number[]>()

      // Group times by chord
      dailyData.transitions.forEach(t => {
        if (!chordTimes.has(t.chord)) {
          chordTimes.set(t.chord, [])
        }
        chordTimes.get(t.chord)!.push(t.time)
      })

      // Calculate averages for each chord
      const averages = Array.from(chordTimes.entries())
        .map(([chord, times]) => ({
          chord,
          time: times.reduce((a, b) => a + b, 0) / times.length
        }))
        .sort((a, b) => a.chord.localeCompare(b.chord))

      // Calculate overall average for the day
      const allTimes = dailyData.transitions.map(t => t.time)
      const overallAverage = allTimes.reduce((a, b) => a + b, 0) / allTimes.length

      return {
        date: dailyData.dateId,
        averages,
        overallAverage
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date)) // Most recent first
})

// Color scale for chords
const chordColorScale = d3.scaleOrdinal(d3.schemeTableau10)

const getChordColor = (chord: string) => {
  return chordColorScale(chord)
}

// Transform data for stacked area chart
interface ChartDataPoint {
  date: Date
  [key: string]: number | Date // chord names as keys with average times as values
}

const transformData = (): ChartDataPoint[] => {
  const dataByDate = new Map<string, ChartDataPoint>()

  progressData.value.forEach(dailyData => {
    const date = new Date(dailyData.dateId)
    const dataPoint: ChartDataPoint = { date }

    // Calculate average time for each chord
    const chordTimes = new Map<string, number[]>()
    dailyData.transitions.forEach(t => {
      if (!chordTimes.has(t.chord)) {
        chordTimes.set(t.chord, [])
      }
      chordTimes.get(t.chord)!.push(t.time)
    })

    chordTimes.forEach((times, chord) => {
      const avg = times.reduce((a, b) => a + b, 0) / times.length
      dataPoint[chord] = avg
    })

    dataByDate.set(dailyData.dateId, dataPoint)
  })

  return Array.from(dataByDate.values()).sort((a, b) => a.date.getTime() - b.date.getTime())
}

const drawChart = () => {
  if (!chartRef.value) return

  // Clear previous chart
  d3.select(chartRef.value).selectAll('*').remove()

  const data = transformData()
  if (data.length === 0) return

  // Extract all unique chord names
  const allChords = new Set<string>()
  data.forEach(d => {
    Object.keys(d).forEach(key => {
      if (key !== 'date') {
        allChords.add(key)
      }
    })
  })
  chordNames.value = Array.from(allChords)

  // Chart dimensions
  const width = 928
  const height = 500
  const marginTop = 20
  const marginRight = 20
  const marginBottom = 40
  const marginLeft = 60

  // Create stacked data
  const stack = d3.stack<ChartDataPoint>()
    .keys(chordNames.value)
    .value((d, key) => (d[key] as number) || 0)

  const series = stack(data)

  // Scales
  const x = d3.scaleTime()
    .domain(d3.extent(data, d => d.date) as [Date, Date])
    .range([marginLeft, width - marginRight])

  const y = d3.scaleLinear()
    .domain([0, d3.max(series, d => d3.max(d, d => d[1])) || 10])
    .nice()
    .range([height - marginBottom, marginTop])

  // Area generator
  const area = d3.area<d3.SeriesPoint<ChartDataPoint>>()
    .x(d => x(d.data.date))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))

  // Create SVG
  const svg = d3.select(chartRef.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .attr('style', 'max-width: 100%; height: auto;')

  // Add areas
  svg.append('g')
    .selectAll('path')
    .data(series)
    .join('path')
    .attr('fill', d => chordColorScale(d.key))
    .attr('d', area)
    .append('title')
    .text(d => d.key)

  // Y-axis
  svg.append('g')
    .attr('transform', `translate(${marginLeft},0)`)
    .call(d3.axisLeft(y).ticks(height / 80))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').clone()
      .attr('x2', width - marginLeft - marginRight)
      .attr('stroke-opacity', 0.1))
    .call(g => g.append('text')
      .attr('x', -marginLeft)
      .attr('y', 15)
      .attr('fill', 'currentColor')
      .attr('text-anchor', 'start')
      .text('↑ Time (seconds)'))

  // X-axis with date formatting
  const dateFormat = d3.timeFormat('%Y-%m-%d')
  svg.append('g')
    .attr('transform', `translate(0,${height - marginBottom})`)
    .call(d3.axisBottom(x)
      .ticks(width / 80)
      .tickFormat((d) => dateFormat(d as Date))
      .tickSizeOuter(0))

  // Add zero line
  svg.append('line')
    .attr('x1', marginLeft)
    .attr('x2', width - marginRight)
    .attr('y1', y(0))
    .attr('y2', y(0))
    .attr('stroke', 'currentColor')
    .attr('stroke-width', 1)
}

const loadData = async () => {
  loading.value = true
  error.value = null

  try {
    const data = await getAllProgress()
    progressData.value = data

    if (data.length > 0) {
      // Wait for next tick to ensure chartRef is available
      setTimeout(() => {
        drawChart()
      }, 0)
    }
  } catch (err) {
    error.value = `Failed to load progress data: ${(err as Error).message}`
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.progress-chart {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.chart-header {
  padding: 1.5rem;
}

.chart-header h2 {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0 0 0.5rem 0;
}

.chart-description {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.chart-container {
  padding: 1.5rem;
  min-height: 500px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart {
  width: 100%;
}

.loading-message,
.error-message,
.empty-message {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
  font-size: 1rem;
}

.error-message {
  color: #ef4444;
}

.legend-container {
  padding: 1.5rem;
}

.legend-container h3 {
  font-size: 1.125rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.legend-items {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend-color {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.legend-item span {
  font-size: 0.875rem;
  color: #374151;
  font-weight: 500;
}

.daily-averages-container {
  padding: 1.5rem;
}

.daily-averages-container h3 {
  font-size: 1.125rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0 0 1rem 0;
}

.daily-averages-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.daily-average-item {
  padding: 1rem;
  background-color: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.date-header {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #d1d5db;
}

.averages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.chord-average {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.chord-name {
  color: #6b7280;
  font-weight: 500;
}

.chord-time {
  color: #1f2937;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.overall-average {
  font-size: 0.875rem;
  font-weight: 600;
  color: #059669;
  padding-top: 0.5rem;
  border-top: 1px solid #d1d5db;
}
</style>
