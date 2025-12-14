<template>
  <div class="progress-chart">
    <div class="chart-header card">
      <div class="header-content">
        <div>
          <h2>Progress Chart</h2>
          <p class="chart-description">Track your practice improvements</p>
          <p class="backup-note">💡 Export/import data on the <strong>Connection</strong> page</p>
        </div>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="tab-navigation card">
      <button
        @click="activeTab = 'chord'"
        class="tab-button"
        :class="{ active: activeTab === 'chord' }"
      >
        Chord Practice
      </button>
      <button
        @click="activeTab = 'plucking'"
        class="tab-button"
        :class="{ active: activeTab === 'plucking' }"
      >
        Plucking Practice
      </button>
    </div>

    <!-- Chord Practice Tab -->
    <div v-if="activeTab === 'chord'">
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

    <!-- Plucking Practice Tab -->
    <div v-if="activeTab === 'plucking'">
      <div class="chart-container card">
        <h3 class="chart-section-title">Practice Time by String</h3>
        <div v-if="loading" class="loading-message">Loading chart data...</div>
        <div v-else-if="error" class="error-message">{{ error }}</div>
        <div v-else-if="!hasPluckingData" class="empty-message">
          No plucking practice data yet. Start practicing to see your progress!
        </div>
        <div v-else ref="pluckingChartRef" class="chart"></div>
      </div>

      <div v-if="hasPluckingData" class="chart-container card">
        <div ref="pluckingAccuracyChartRef" class="chart"></div>
      </div>

      <div v-if="hasPluckingData" class="legend-container card">
        <h3>String Legend</h3>
        <div class="legend-items">
          <div
            v-for="string in stringNumbers"
            :key="string"
            class="legend-item"
          >
            <div
              class="legend-color"
              :style="{ backgroundColor: getStringColor(string) }"
            ></div>
            <span>String {{ string }} ({{ getStringName(string) }})</span>
          </div>
        </div>
      </div>

      <div v-if="hasPluckingData" class="daily-averages-container card">
        <h3>Daily Averages (Time)</h3>
        <div class="daily-averages-list">
          <div
            v-for="day in pluckingDailyAverages"
            :key="day.date"
            class="daily-average-item"
          >
            <div class="date-header">{{ day.date }}</div>
            <div class="averages-grid">
              <div
                v-for="avg in day.averages"
                :key="avg.string"
                class="chord-average"
              >
                <span class="chord-name">String {{ avg.string }}:</span>
                <span class="chord-time">{{ avg.time.toFixed(2) }}s</span>
              </div>
            </div>
            <div class="overall-average">
              Overall: {{ day.overallAverage.toFixed(2) }}s
            </div>
          </div>
        </div>
      </div>

      <div v-if="hasPluckingData" class="accuracy-container card">
        <h3>Plucking Accuracy (Average Attempts)</h3>
        <p class="accuracy-description">Lower is better - 1.0 means perfect accuracy!</p>
        <div class="daily-averages-list">
          <div
            v-for="day in pluckingAccuracyData"
            :key="day.date"
            class="daily-average-item"
          >
            <div class="date-header">{{ day.date }}</div>
            <div class="averages-grid">
              <div
                v-for="acc in day.accuracies"
                :key="acc.string"
                class="chord-average"
                :class="getAccuracyClass(acc.attempts)"
              >
                <span class="chord-name">String {{ acc.string }}:</span>
                <span class="accuracy-value">{{ acc.attempts.toFixed(2) }} attempts</span>
              </div>
            </div>
            <div class="overall-average" :class="getAccuracyClass(day.overallAccuracy)">
              Overall: {{ day.overallAccuracy.toFixed(2) }} attempts
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import * as d3 from 'd3'
import { getAllProgress, getAllPluckingProgress, type DailyProgress, type DailyPluckingProgress } from '../db/practiceDb'

// Tab state
const activeTab = ref<'chord' | 'plucking'>('chord')

// Chord practice data
const chartRef = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const progressData = ref<DailyProgress[]>([])
const chordNames = ref<string[]>([])

// Plucking practice data
const pluckingChartRef = ref<HTMLElement | null>(null)
const pluckingAccuracyChartRef = ref<HTMLElement | null>(null)
const pluckingProgressData = ref<DailyPluckingProgress[]>([])
const stringNumbers = ref<number[]>([])

const hasData = computed(() => progressData.value.length > 0)
const hasPluckingData = computed(() => pluckingProgressData.value.length > 0)

// String names
const STRING_NAMES: Record<number, string> = {
  1: 'e (high)',
  2: 'B',
  3: 'G',
  4: 'D',
  5: 'A',
  6: 'E (low)'
}

const getStringName = (string: number): string => {
  return STRING_NAMES[string] || `String ${string}`
}

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

// Calculate plucking daily averages
interface PluckingDailyAverage {
  date: string
  averages: { string: number; time: number }[]
  overallAverage: number
}

const pluckingDailyAverages = computed((): PluckingDailyAverage[] => {
  return pluckingProgressData.value
    .map(dailyData => {
      const stringTimes = new Map<number, number[]>()

      // Group times by string
      dailyData.plucks.forEach(p => {
        if (!stringTimes.has(p.string)) {
          stringTimes.set(p.string, [])
        }
        stringTimes.get(p.string)!.push(p.time)
      })

      // Calculate averages for each string
      const averages = Array.from(stringTimes.entries())
        .map(([string, times]) => ({
          string,
          time: times.reduce((a, b) => a + b, 0) / times.length
        }))
        .sort((a, b) => a.string - b.string)

      // Calculate overall average for the day
      const allTimes = dailyData.plucks.map(p => p.time)
      const overallAverage = allTimes.reduce((a, b) => a + b, 0) / allTimes.length

      return {
        date: dailyData.dateId,
        averages,
        overallAverage
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date)) // Most recent first
})

// Calculate plucking accuracy (average attempts per string)
interface PluckingAccuracyData {
  date: string
  accuracies: { string: number; attempts: number }[]
  overallAccuracy: number
}

const pluckingAccuracyData = computed((): PluckingAccuracyData[] => {
  return pluckingProgressData.value
    .map(dailyData => {
      const stringAttempts = new Map<number, number[]>()

      // Group attempts by string
      dailyData.plucks.forEach(p => {
        if (!stringAttempts.has(p.string)) {
          stringAttempts.set(p.string, [])
        }
        // Use attempts if available, otherwise default to 1
        stringAttempts.get(p.string)!.push(p.attempts || 1)
      })

      // Calculate averages for each string
      const accuracies = Array.from(stringAttempts.entries())
        .map(([string, attempts]) => ({
          string,
          attempts: attempts.reduce((a, b) => a + b, 0) / attempts.length
        }))
        .sort((a, b) => a.string - b.string)

      // Calculate overall accuracy for the day
      const allAttempts = dailyData.plucks.map(p => p.attempts || 1)
      const overallAccuracy = allAttempts.reduce((a, b) => a + b, 0) / allAttempts.length

      return {
        date: dailyData.dateId,
        accuracies,
        overallAccuracy
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date)) // Most recent first
})

// Get accuracy class for color coding
const getAccuracyClass = (attempts: number): string => {
  if (attempts <= 1.2) return 'accuracy-excellent'
  if (attempts <= 2.0) return 'accuracy-good'
  if (attempts <= 3.0) return 'accuracy-fair'
  return 'accuracy-poor'
}

// Color scale for chords
const chordColorScale = d3.scaleOrdinal(d3.schemeTableau10)

const getChordColor = (chord: string) => {
  return chordColorScale(chord)
}

// Color scale for strings
const stringColorScale = d3.scaleOrdinal(d3.schemeCategory10)

const getStringColor = (string: number) => {
  return stringColorScale(string.toString())
}

// Transform data for stacked area chart
interface ChartDataPoint {
  date: string
  [key: string]: number | string // chord names as keys with average times as values
}

const transformData = (): ChartDataPoint[] => {
  const dataByDate = new Map<string, ChartDataPoint>()

  progressData.value.forEach(dailyData => {
    const dataPoint: ChartDataPoint = { date: dailyData.dateId }

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

  return Array.from(dataByDate.values()).sort((a, b) => a.date.localeCompare(b.date))
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
  const x = d3.scalePoint()
    .domain(data.map(d => d.date))
    .range([marginLeft, width - marginRight])

  const y = d3.scaleLinear()
    .domain([0, d3.max(series, d => d3.max(d, d => d[1])) || 10])
    .nice()
    .range([height - marginBottom, marginTop])

  // Area generator
  const area = d3.area<d3.SeriesPoint<ChartDataPoint>>()
    .x(d => x(d.data.date) || 0)
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

  // X-axis - displays date strings directly
  svg.append('g')
    .attr('transform', `translate(0,${height - marginBottom})`)
    .call(d3.axisBottom(x)
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

// Transform plucking data for stacked area chart
const transformPluckingData = (): ChartDataPoint[] => {
  const dataByDate = new Map<string, ChartDataPoint>()

  pluckingProgressData.value.forEach(dailyData => {
    const dataPoint: ChartDataPoint = { date: dailyData.dateId }

    // Calculate average time for each string
    const stringTimes = new Map<string, number[]>()
    dailyData.plucks.forEach(p => {
      const stringKey = p.string.toString()
      if (!stringTimes.has(stringKey)) {
        stringTimes.set(stringKey, [])
      }
      stringTimes.get(stringKey)!.push(p.time)
    })

    stringTimes.forEach((times, stringKey) => {
      const avg = times.reduce((a, b) => a + b, 0) / times.length
      dataPoint[stringKey] = avg
    })

    dataByDate.set(dailyData.dateId, dataPoint)
  })

  return Array.from(dataByDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

const drawPluckingChart = () => {
  if (!pluckingChartRef.value) return

  // Clear previous chart
  d3.select(pluckingChartRef.value).selectAll('*').remove()

  const data = transformPluckingData()
  if (data.length === 0) return

  // Extract all unique string numbers
  const allStrings = new Set<string>()
  data.forEach(d => {
    Object.keys(d).forEach(key => {
      if (key !== 'date') {
        allStrings.add(key)
      }
    })
  })
  stringNumbers.value = Array.from(allStrings).map(s => parseInt(s)).sort((a, b) => a - b)

  // Chart dimensions
  const width = 928
  const height = 500
  const marginTop = 20
  const marginRight = 20
  const marginBottom = 40
  const marginLeft = 60

  // Create stacked data
  const stack = d3.stack<ChartDataPoint>()
    .keys(stringNumbers.value.map(s => s.toString()))
    .value((d, key) => (d[key] as number) || 0)

  const series = stack(data)

  // Scales
  const x = d3.scalePoint()
    .domain(data.map(d => d.date))
    .range([marginLeft, width - marginRight])

  const y = d3.scaleLinear()
    .domain([0, d3.max(series, d => d3.max(d, d => d[1])) || 10])
    .nice()
    .range([height - marginBottom, marginTop])

  // Area generator
  const area = d3.area<d3.SeriesPoint<ChartDataPoint>>()
    .x(d => x(d.data.date) || 0)
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))

  // Create SVG
  const svg = d3.select(pluckingChartRef.value)
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
    .attr('fill', d => stringColorScale(d.key))
    .attr('d', area)
    .append('title')
    .text(d => `String ${d.key}`)

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

  // X-axis - displays date strings directly
  svg.append('g')
    .attr('transform', `translate(0,${height - marginBottom})`)
    .call(d3.axisBottom(x)
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

// Draw plucking accuracy chart (line chart showing attempts over time)
const drawPluckingAccuracyChart = () => {
  if (!pluckingAccuracyChartRef.value) return

  // Clear previous chart
  d3.select(pluckingAccuracyChartRef.value).selectAll('*').remove()

  const data = pluckingAccuracyData.value
  if (data.length === 0) return

  // Extract all unique string numbers from accuracy data
  const allStrings = new Set<number>()
  data.forEach(d => {
    d.accuracies.forEach(acc => allStrings.add(acc.string))
  })
  const strings = Array.from(allStrings).sort((a, b) => a - b)

  // Chart dimensions
  const width = 928
  const height = 400
  const marginTop = 40
  const marginRight = 100
  const marginBottom = 60
  const marginLeft = 60

  // Scales
  const x = d3.scalePoint()
    .domain(data.map(d => d.date))
    .range([marginLeft, width - marginRight])

  const maxAttempts = d3.max(data, d => d3.max(d.accuracies, acc => acc.attempts)) || 5
  const y = d3.scaleLinear()
    .domain([1, maxAttempts])  // Start from 1.0 (perfect accuracy)
    .nice()
    .range([height - marginBottom, marginTop])

  // Line generator
  const line = d3.line<{ date: string; attempts: number }>()
    .x(d => x(d.date) || 0)
    .y(d => y(d.attempts))
    .defined(d => !isNaN(d.attempts))

  // Create SVG
  const svg = d3.select(pluckingAccuracyChartRef.value)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .attr('style', 'max-width: 100%; height: auto;')

  // Add a background reference area for "good" accuracy (1.0-2.0)
  const goodAccuracyMax = Math.min(2, y.domain()[1] ?? 5)
  svg.append('rect')
    .attr('x', marginLeft)
    .attr('y', y(goodAccuracyMax))
    .attr('width', width - marginLeft - marginRight)
    .attr('height', y(1) - y(goodAccuracyMax))
    .attr('fill', '#d1fae5')
    .attr('opacity', 0.2)

  // Add lines for each string
  strings.forEach(stringNum => {
    // Get data points for this string
    const stringData = data.map(d => {
      const acc = d.accuracies.find(a => a.string === stringNum)
      return {
        date: d.date,
        attempts: acc ? acc.attempts : NaN
      }
    }).filter(d => !isNaN(d.attempts))

    if (stringData.length === 0) return

    // Draw line
    svg.append('path')
      .datum(stringData)
      .attr('fill', 'none')
      .attr('stroke', stringColorScale(stringNum.toString()))
      .attr('stroke-width', 2.5)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('d', line)

    // Add dots at each data point
    svg.append('g')
      .selectAll('circle')
      .data(stringData)
      .join('circle')
      .attr('cx', d => x(d.date) || 0)
      .attr('cy', d => y(d.attempts))
      .attr('r', 4)
      .attr('fill', stringColorScale(stringNum.toString()))
      .attr('stroke', 'white')
      .attr('stroke-width', 2)
      .append('title')
      .text(d => `String ${stringNum}: ${d.attempts.toFixed(2)} attempts`)
  })

  // Y-axis
  svg.append('g')
    .attr('transform', `translate(${marginLeft},0)`)
    .call(d3.axisLeft(y).ticks(height / 60))
    .call(g => g.select('.domain').remove())
    .call(g => g.selectAll('.tick line').clone()
      .attr('x2', width - marginLeft - marginRight)
      .attr('stroke-opacity', 0.1))
    .call(g => g.append('text')
      .attr('x', -marginLeft)
      .attr('y', 15)
      .attr('fill', 'currentColor')
      .attr('text-anchor', 'start')
      .text('↓ Average Attempts (lower is better)'))

  // X-axis
  svg.append('g')
    .attr('transform', `translate(0,${height - marginBottom})`)
    .call(d3.axisBottom(x).tickSizeOuter(0))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end')

  // Add reference line at 1.0 (perfect accuracy)
  svg.append('line')
    .attr('x1', marginLeft)
    .attr('x2', width - marginRight)
    .attr('y1', y(1))
    .attr('y2', y(1))
    .attr('stroke', '#10b981')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '5,5')

  // Add label for perfect accuracy line
  svg.append('text')
    .attr('x', width - marginRight + 5)
    .attr('y', y(1) + 5)
    .attr('fill', '#10b981')
    .attr('font-size', 12)
    .attr('font-weight', 'bold')
    .text('Perfect')

  // Add chart title
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .attr('font-size', 16)
    .attr('font-weight', 'bold')
    .attr('fill', '#1f2937')
    .text('Plucking Accuracy Over Time')
}

const loadData = async () => {
  loading.value = true
  error.value = null

  try {
    // Load both chord and plucking data
    const [chordData, pluckingData] = await Promise.all([
      getAllProgress(),
      getAllPluckingProgress()
    ])

    progressData.value = chordData
    pluckingProgressData.value = pluckingData

    // Draw the appropriate chart based on active tab
    setTimeout(() => {
      if (activeTab.value === 'chord' && chordData.length > 0) {
        drawChart()
      } else if (activeTab.value === 'plucking' && pluckingData.length > 0) {
        drawPluckingChart()
        drawPluckingAccuracyChart()
      }
    }, 0)
  } catch (err) {
    error.value = `Failed to load progress data: ${(err as Error).message}`
  } finally {
    loading.value = false
  }
}

// Watch for tab changes to redraw charts
watch(activeTab, (newTab) => {
  setTimeout(() => {
    if (newTab === 'chord' && progressData.value.length > 0) {
      drawChart()
    } else if (newTab === 'plucking' && pluckingProgressData.value.length > 0) {
      drawPluckingChart()
      drawPluckingAccuracyChart()
    }
  }, 0)
})

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

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
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
  margin: 0 0 0.5rem 0;
}

.backup-note {
  font-size: 0.8125rem;
  color: #6366f1;
  margin: 0.5rem 0 0 0;
  font-style: italic;
}

.backup-note strong {
  font-weight: 600;
}

.chart-container {
  padding: 1.5rem;
  min-height: 500px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.chart-section-title {
  font-size: 1.125rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0 0 1rem 0;
  align-self: flex-start;
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

.tab-navigation {
  padding: 1rem;
  display: flex;
  gap: 0.5rem;
  background: white;
  border-radius: 8px;
}

.tab-button {
  padding: 0.75rem 1.5rem;
  border: 1px solid #d1d5db;
  background: white;
  color: #6b7280;
  border-radius: 6px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-button:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.tab-button.active {
  background: #312e81;
  color: white;
  border-color: #312e81;
}

/* Accuracy container */
.accuracy-container {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.accuracy-description {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.5rem;
  margin-bottom: 1rem;
  font-style: italic;
}

.accuracy-value {
  color: #1f2937;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

/* Accuracy color coding */
.accuracy-excellent {
  background-color: #d1fae5 !important;
  border-left: 4px solid #10b981;
}

.accuracy-good {
  background-color: #dbeafe !important;
  border-left: 4px solid #3b82f6;
}

.accuracy-fair {
  background-color: #fef3c7 !important;
  border-left: 4px solid #f59e0b;
}

.accuracy-poor {
  background-color: #fee2e2 !important;
  border-left: 4px solid #ef4444;
}

.accuracy-excellent .overall-average {
  color: #059669;
}

.accuracy-good .overall-average {
  color: #2563eb;
}

.accuracy-fair .overall-average {
  color: #d97706;
}

.accuracy-poor .overall-average {
  color: #dc2626;
}
</style>
