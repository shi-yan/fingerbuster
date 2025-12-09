<template>
  <div class="plucking-practice">
    <div class="practice-header card">
      <h2>Plucking Accuracy Practice</h2>
      <div class="practice-controls">
        <div class="difficulty-selector">
          <label for="difficulty">Difficulty Level:</label>
          <select
            id="difficulty"
            v-model="difficulty"
            :disabled="isStarted"
            class="difficulty-dropdown"
          >
            <option :value="1">Level 1 - Single String</option>
            <option :value="2">Level 2 - Two Strings</option>
            <option :value="3">Level 3 - Three Strings</option>
          </select>
        </div>
        <button
          v-if="!isStarted"
          @click="startPractice"
          class="btn-primary"
        >
          Start Practice
        </button>
        <button
          v-else
          @click="stopPractice"
          class="btn-danger"
        >
          Stop Practice
        </button>
      </div>
    </div>

    <div v-if="isStarted" class="status-display card">
      <div class="status-info">
        <p class="attempt-counter">Attempt: {{ attemptCount }}</p>
        <p v-if="startTime" class="timer">Time: {{ currentTime.toFixed(2) }}s</p>
      </div>
      <div class="instruction">
        <p>Pluck the highlighted strings in order (top to bottom)</p>
      </div>
    </div>

    <!-- Guitar String Visualization -->
    <div v-if="isStarted" class="guitar-visualization card">
      <div class="guitar-body">
        <div class="sound-hole">
          <div class="sound-hole-inner"></div>
        </div>
        <div class="strings-container">
          <div
            v-for="string in 6"
            :key="string"
            class="string-row"
            :class="getStringClass(string)"
          >
            <div class="string-label">{{ getStringName(string) }}</div>
            <div class="string-line"></div>
            <div class="string-status">
              <span v-if="targetStrings.includes(string)" class="target-indicator">
                {{ targetStrings.indexOf(string) + 1 }}
              </span>
              <span v-if="pluckedStringsInOrder.includes(string)" class="status-icon correct">✓</span>
              <span v-if="wrongStrings.has(string)" class="status-icon wrong">✗</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Debug Information -->
    <div v-if="isStarted" class="debug-display card">
      <h3>Debug Information</h3>
      <div class="debug-section">
        <div class="debug-item">
          <span class="debug-label">Target Strings:</span>
          <span class="debug-value">{{ targetStrings.join(', ') }}</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Plucked in Order:</span>
          <span class="debug-value">{{ pluckedStringsInOrder.join(', ') || 'None' }}</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">Wrong Strings:</span>
          <span class="debug-value">{{ Array.from(wrongStrings).join(', ') || 'None' }}</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">All Plucked:</span>
          <span class="debug-value">{{ Array.from(stringsPlucked).join(', ') || 'None' }}</span>
        </div>
      </div>
    </div>

    <!-- Statistics Display -->
    <div v-if="statistics.length > 0" class="statistics card">
      <h3>Session Statistics</h3>
      <div class="stats-grid">
        <div
          v-for="stat in statistics"
          :key="stat.string"
          class="stat-item"
        >
          <div class="stat-string">String {{ stat.string }} ({{ getStringName(stat.string) }})</div>
          <div class="stat-times">
            <div class="stat-row">
              <span class="stat-label">Average:</span>
              <span class="stat-value">{{ stat.average.toFixed(2) }}s</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Best:</span>
              <span class="stat-value best">{{ stat.best.toFixed(2) }}s</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">Attempts:</span>
              <span class="stat-value">{{ stat.attempts }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { sharedMidi } from '../midi'
import { addStringPluck } from '../db/practiceDb'

const { stringsPlucked, pluckOrder, clearStringsPlucked } = sharedMidi

// Practice state
const isStarted = ref(false)
const difficulty = ref(1)
const targetStrings = ref<number[]>([])
const pluckedStringsInOrder = ref<number[]>([])
const wrongStrings = ref<Set<number>>(new Set())
const startTime = ref<number | null>(null)
const currentTime = ref(0)
const attemptCount = ref(0)
let animationFrameId: number | null = null

// Statistics
interface StringStats {
  string: number
  times: number[]
  average: number
  best: number
  attempts: number
}

const sessionStats = ref<Map<number, number[]>>(new Map())
const statistics = computed(() => {
  const stats: StringStats[] = []
  sessionStats.value.forEach((times, string) => {
    if (times.length > 0) {
      const average = times.reduce((a, b) => a + b, 0) / times.length
      const best = Math.min(...times)
      stats.push({
        string,
        times,
        average,
        best,
        attempts: times.length
      })
    }
  })
  return stats.sort((a, b) => a.string - b.string)
})

// String names (from high to low pitch)
const STRING_NAMES: Record<number, string> = {
  1: 'e (high)',
  2: 'B',
  3: 'G',
  4: 'D',
  5: 'A',
  6: 'E (low)'
}

function getStringName(string: number): string {
  return STRING_NAMES[string] || `String ${string}`
}

function getStringClass(string: number): string {
  const classes: string[] = []

  if (targetStrings.value.includes(string)) {
    classes.push('target-string')
  }

  if (pluckedStringsInOrder.value.includes(string)) {
    classes.push('correct-string')
  }

  if (wrongStrings.value.has(string)) {
    classes.push('wrong-string')
  }

  return classes.join(' ')
}

function generateRandomStrings(): number[] {
  const allStrings = [1, 2, 3, 4, 5, 6]
  const count = difficulty.value

  // Fisher-Yates shuffle
  const shuffled = [...allStrings]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = shuffled[i]!
    shuffled[i] = shuffled[j]!
    shuffled[j] = temp
  }

  // Take first 'count' strings and sort them from highest to lowest (6 to 1)
  return shuffled.slice(0, count).sort((a, b) => b - a)
}

function startPractice() {
  isStarted.value = true
  attemptCount.value = 0
  sessionStats.value.clear()
  startNewRound()
}

function stopPractice() {
  isStarted.value = false
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  targetStrings.value = []
  pluckedStringsInOrder.value = []
  wrongStrings.value.clear()
  startTime.value = null
  clearStringsPlucked()
}

function startNewRound() {
  targetStrings.value = generateRandomStrings()
  pluckedStringsInOrder.value = []
  wrongStrings.value.clear()
  startTime.value = Date.now()
  clearStringsPlucked()
  attemptCount.value++

  console.log(`🎸 New Round ${attemptCount.value}:`)
  console.log(`   Target strings: ${targetStrings.value.join(', ')}`)
  console.log(`   Difficulty level: ${difficulty.value}`)

  // Start timer animation
  updateTimer()
}

function updateTimer() {
  if (startTime.value !== null && isStarted.value) {
    currentTime.value = (Date.now() - startTime.value) / 1000
    animationFrameId = requestAnimationFrame(updateTimer)
  }
}

async function checkPlucking() {
  // Get the next expected string
  const nextIndex = pluckedStringsInOrder.value.length
  const expectedString = targetStrings.value[nextIndex]

  console.log(`🎯 Checking plucks. Expected string: ${expectedString}, Next index: ${nextIndex}`)
  console.log(`   Currently plucked: ${Array.from(stringsPlucked.value).join(', ')}`)
  console.log(`   Already correct: ${pluckedStringsInOrder.value.join(', ')}`)
  console.log(`   Already wrong: ${Array.from(wrongStrings.value).join(', ')}`)

  // Check all currently plucked strings
  const pluckedArray = Array.from(stringsPlucked.value)

  for (const string of pluckedArray) {
    // Skip if we've already processed this string
    if (pluckedStringsInOrder.value.includes(string) || wrongStrings.value.has(string)) {
      console.log(`   Skipping string ${string} (already processed)`)
      continue
    }

    // Check if this is the expected string
    if (string === expectedString) {
      console.log(`   ✅ Correct! String ${string} matches expected ${expectedString}`)
      pluckedStringsInOrder.value.push(string)

      // Check if we've completed all target strings
      if (pluckedStringsInOrder.value.length === targetStrings.value.length) {
        console.log(`   🎉 All strings completed!`)
        await completeRound()
      }
    } else {
      // Wrong string plucked
      console.log(`   ❌ Wrong! String ${string} doesn't match expected ${expectedString}`)
      wrongStrings.value.add(string)
    }
  }
}

async function completeRound() {
  if (startTime.value === null) return

  const timeTaken = (Date.now() - startTime.value) / 1000

  // Save to statistics
  for (const string of targetStrings.value) {
    if (!sessionStats.value.has(string)) {
      sessionStats.value.set(string, [])
    }
    sessionStats.value.get(string)!.push(timeTaken)

    // Save to IndexedDB
    await addStringPluck(string, timeTaken)
  }

  // Wait a bit before starting new round
  setTimeout(() => {
    if (isStarted.value) {
      startNewRound()
    }
  }, 800)
}

// Watch for string plucks
watch([stringsPlucked, pluckOrder], () => {
  console.log(`👀 Watch triggered - stringsPlucked: ${Array.from(stringsPlucked.value).join(', ')}, pluckOrder: ${pluckOrder.value.join(', ')}`)
  if (isStarted.value && targetStrings.value.length > 0) {
    console.log(`   Practice is started, checking plucking...`)
    checkPlucking()
  } else {
    console.log(`   Practice not started or no targets: isStarted=${isStarted.value}, targets=${targetStrings.value.length}`)
  }
})
</script>

<style scoped>
.plucking-practice {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2rem;
}

.card {
  background: #1e1e1e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 1.5rem;
}

.practice-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.practice-header h2 {
  margin: 0;
  color: #fff;
}

.practice-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.difficulty-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.difficulty-selector label {
  color: #ccc;
  font-size: 0.9rem;
}

.difficulty-dropdown {
  padding: 0.5rem 1rem;
  background: #2a2a2a;
  color: #fff;
  border: 1px solid #444;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
}

.difficulty-dropdown:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary,
.btn-danger {
  padding: 0.5rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #4CAF50;
  color: white;
}

.btn-primary:hover {
  background: #45a049;
}

.btn-danger {
  background: #f44336;
  color: white;
}

.btn-danger:hover {
  background: #da190b;
}

.status-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.status-info {
  display: flex;
  gap: 2rem;
}

.attempt-counter,
.timer {
  margin: 0;
  color: #fff;
  font-size: 1.1rem;
}

.instruction {
  color: #ffa500;
  font-size: 1rem;
}

.instruction p {
  margin: 0;
}

/* Guitar Visualization */
.guitar-visualization {
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.guitar-body {
  position: relative;
  background: linear-gradient(135deg, #8B4513 0%, #654321 100%);
  border-radius: 20px;
  padding: 3rem 2rem;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  min-height: 400px;
}

.sound-hole {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 180px;
  height: 180px;
  background: radial-gradient(circle at center, #000 0%, #1a1a1a 70%, #000 100%);
  border-radius: 50%;
  border: 4px solid #654321;
  box-shadow:
    inset 0 0 30px rgba(0, 0, 0, 0.8),
    0 4px 10px rgba(0, 0, 0, 0.5);
  z-index: 1;
}

.sound-hole-inner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 140px;
  height: 140px;
  border: 3px solid #8B4513;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
}

.sound-hole-inner::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100px;
  height: 100px;
  border: 2px solid #654321;
  border-radius: 50%;
  opacity: 0.6;
}

.strings-container {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding: 0 2rem;
  z-index: 2;
}

.string-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  transition: all 0.3s;
  background: transparent;
}

.string-row.target-string {
  background: rgba(255, 165, 0, 0.15);
  border: 2px solid #ffa500;
  box-shadow: 0 0 10px rgba(255, 165, 0, 0.3);
}

.string-row.correct-string {
  background: rgba(76, 175, 80, 0.15);
  border: 2px solid #4CAF50;
  box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
}

.string-row.wrong-string {
  background: rgba(244, 67, 54, 0.15);
  border: 2px solid #f44336;
  box-shadow: 0 0 10px rgba(244, 67, 54, 0.3);
}

.string-label {
  min-width: 90px;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 500;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.string-line {
  flex: 1;
  height: 2px;
  background: linear-gradient(90deg, #c0c0c0 0%, #808080 50%, #c0c0c0 100%);
  border-radius: 1px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.5),
    0 -1px 1px rgba(255, 255, 255, 0.1);
  position: relative;
}

.string-row:nth-child(1) .string-line {
  height: 1px;
  background: linear-gradient(90deg, #d4d4d4 0%, #a0a0a0 50%, #d4d4d4 100%);
}
.string-row:nth-child(2) .string-line {
  height: 1.5px;
  background: linear-gradient(90deg, #d0d0d0 0%, #909090 50%, #d0d0d0 100%);
}
.string-row:nth-child(3) .string-line {
  height: 2px;
  background: linear-gradient(90deg, #c0c0c0 0%, #808080 50%, #c0c0c0 100%);
}
.string-row:nth-child(4) .string-line {
  height: 2.5px;
  background: linear-gradient(90deg, #b8b0a0 0%, #706040 50%, #b8b0a0 100%);
}
.string-row:nth-child(5) .string-line {
  height: 3px;
  background: linear-gradient(90deg, #b0a090 0%, #604030 50%, #b0a090 100%);
}
.string-row:nth-child(6) .string-line {
  height: 3.5px;
  background: linear-gradient(90deg, #a89080 0%, #503020 50%, #a89080 100%);
}

.string-status {
  min-width: 60px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.target-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: #ffa500;
  color: #000;
  border-radius: 50%;
  font-weight: bold;
  font-size: 0.85rem;
}

.status-icon {
  font-size: 1.2rem;
  font-weight: bold;
}

.status-icon.correct {
  color: #4CAF50;
}

.status-icon.wrong {
  color: #f44336;
}

/* Debug Display */
.debug-display {
  background: #252525;
}

.debug-display h3 {
  margin: 0 0 1rem 0;
  color: #fff;
  font-size: 1.1rem;
}

.debug-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.debug-item {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #1e1e1e;
  border-radius: 4px;
}

.debug-label {
  color: #888;
  min-width: 150px;
}

.debug-value {
  color: #4CAF50;
  font-family: monospace;
}

/* Statistics */
.statistics {
  background: #1e1e1e;
}

.statistics h3 {
  margin: 0 0 1.5rem 0;
  color: #fff;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-item {
  background: #252525;
  padding: 1rem;
  border-radius: 6px;
  border: 1px solid #333;
}

.stat-string {
  color: #4CAF50;
  font-weight: bold;
  margin-bottom: 0.5rem;
  font-size: 1rem;
}

.stat-times {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
}

.stat-label {
  color: #888;
}

.stat-value {
  color: #fff;
}

.stat-value.best {
  color: #ffa500;
  font-weight: bold;
}
</style>
