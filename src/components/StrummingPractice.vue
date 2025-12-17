<template>
  <div class="strumming-practice">
    <h2>Strumming Practice</h2>

    <!-- Pattern Selection -->
    <div class="pattern-selector">
      <label for="pattern-select">Pattern:</label>
      <select id="pattern-select" v-model="selectedPatternId" @change="onPatternChange">
        <optgroup label="Beginner">
          <option v-for="pattern in beginnerPatterns" :key="pattern.id" :value="pattern.id">
            {{ pattern.name }}
          </option>
        </optgroup>
        <optgroup label="Intermediate">
          <option v-for="pattern in intermediatePatterns" :key="pattern.id" :value="pattern.id">
            {{ pattern.name }}
          </option>
        </optgroup>
        <optgroup label="Advanced">
          <option v-for="pattern in advancedPatterns" :key="pattern.id" :value="pattern.id">
            {{ pattern.name }}
          </option>
        </optgroup>
      </select>
    </div>

    <div v-if="currentPattern" class="pattern-info">
      <p class="pattern-description">{{ currentPattern.description }}</p>
      <p class="pattern-difficulty">
        <span :class="'difficulty-' + currentPattern.difficulty">
          {{ currentPattern.difficulty.toUpperCase() }}
        </span>
        | Recommended BPM: {{ currentPattern.recommendedBPM.min }}-{{ currentPattern.recommendedBPM.max }}
      </p>
    </div>

    <!-- Metronome Controls -->
    <div class="metronome-controls">
      <div class="bpm-control">
        <label for="bpm-slider">BPM: {{ metronome.bpm.value }}</label>
        <input
          id="bpm-slider"
          type="range"
          min="40"
          max="180"
          v-model.number="metronome.bpm.value"
          :disabled="metronome.isPlaying.value"
        />
      </div>

      <div class="control-buttons">
        <button @click="startPractice" :disabled="metronome.isPlaying.value" class="btn-start">
          ▶ Start
        </button>
        <button @click="stopPractice" :disabled="!metronome.isPlaying.value" class="btn-stop">
          ⏹ Stop
        </button>
        <button @click="resetPractice" class="btn-reset">
          ↻ Reset
        </button>
        <button @click="metronome.toggleClick()" class="btn-click">
          {{ metronome.clickEnabled.value ? '🔊' : '🔇' }} Click
        </button>
      </div>
    </div>

    <!-- Timeline Visualization -->
    <div v-if="metronome.isPlaying.value && currentPattern" class="timeline-container">
      <div class="timeline-header">
        <div class="beat-indicator">
          Bar {{ metronome.currentBar.value + 1 }} | Beat {{ metronome.currentBeat.value + 1 }}
        </div>
      </div>

      <div class="timeline" ref="timelineRef">
        <div class="timeline-track">
          <!-- Render strums -->
          <div
            v-for="(strum, index) in visibleStrums"
            :key="index"
            class="strum-marker"
            :class="{
              'strum-past': strum.status === 'past',
              'strum-current': strum.status === 'current',
              'strum-future': strum.status === 'future',
              'strum-success': strum.result?.valid === true,
              'strum-failure': strum.result?.valid === false,
              'strum-emphasis': strum.instruction.emphasis
            }"
            :style="{ left: strum.position + '%' }"
          >
            <div class="strum-icon">
              {{ strum.instruction.direction === 'down' ? '↓' : '↑' }}
            </div>
            <div class="strum-strings">
              {{ formatStrings(strum.instruction.strings) }}
            </div>
          </div>

          <!-- Playhead -->
          <div class="playhead" :style="{ left: playheadPosition + '%' }"></div>
        </div>
      </div>

      <!-- Current Strum Feedback -->
      <div v-if="currentStrumFeedback" class="strum-feedback">
        <div v-if="currentStrumFeedback.valid" class="feedback-success">
          ✓ Great! {{ currentStrumFeedback.direction.toUpperCase() }} strum detected
        </div>
        <div v-else class="feedback-error">
          <div v-if="currentStrumFeedback.direction !== expectedDirection">
            ✗ Wrong direction! Expected {{ expectedDirection?.toUpperCase() }}, got {{ currentStrumFeedback.direction.toUpperCase() }}
          </div>
          <div v-if="currentStrumFeedback.wrongStrings.length > 0">
            ✗ Wrong strings: {{ currentStrumFeedback.wrongStrings.join(', ') }}
          </div>
          <div v-if="currentStrumFeedback.missedStrings.length > 0">
            ✗ Missed strings: {{ currentStrumFeedback.missedStrings.join(', ') }}
          </div>
        </div>
      </div>
    </div>

    <!-- Score Display -->
    <div class="score-display">
      <div class="score-item">
        <span class="score-label">Successful Strums:</span>
        <span class="score-value">{{ successfulStrums }} / {{ totalAttempts }}</span>
      </div>
      <div class="score-item">
        <span class="score-label">Accuracy:</span>
        <span class="score-value">{{ accuracyPercentage }}%</span>
      </div>
    </div>

    <!-- Debug Info (can be hidden in production) -->
    <details class="debug-panel">
      <summary>Debug Info</summary>
      <div class="debug-content">
        <p>Current Time: {{ Math.round(metronome.elapsedTime.value) }}ms</p>
        <p>Beat Duration: {{ Math.round(metronome.beatDuration.value) }}ms</p>
        <p>Events in Buffer: {{ strumDetector.eventBuffer.value.length }}</p>
        <p>Last Event: {{ strumDetector.lastEventTime.value }}ms</p>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { sharedMidi } from '../composables/useMidi'
import { useMetronome } from '../composables/useMetronome'
import { useStrumDetection } from '../composables/useStrumDetection'
import { getPatternsByDifficulty, getPatternById } from '../data/strummingPatterns'
import type { StrumPattern, StrumInstruction, StrumValidationResult } from '../types/strumming'

// Pattern selection
const selectedPatternId = ref('basic-down')
const currentPattern = ref<StrumPattern | undefined>(getPatternById('basic-down'))

const beginnerPatterns = computed(() => getPatternsByDifficulty('beginner'))
const intermediatePatterns = computed(() => getPatternsByDifficulty('intermediate'))
const advancedPatterns = computed(() => getPatternsByDifficulty('advanced'))

// Metronome setup
const metronome = useMetronome({
  bpm: 60,
  beatsPerBar: 4,
  subdivision: 2 // Eighth notes
})

// Strum detection
const strumDetector = useStrumDetection()

// Timeline refs
const timelineRef = ref<HTMLElement | null>(null)

// Tracking state
interface StrumSlot {
  instruction: StrumInstruction;
  status: 'past' | 'current' | 'future';
  position: number; // Percentage position on timeline
  result?: StrumValidationResult;
}

const strumSlots = ref<StrumSlot[]>([])
const currentStrumIndex = ref(0)
const currentStrumFeedback = ref<StrumValidationResult | null>(null)
const expectedDirection = ref<'down' | 'up' | null>(null)

// Scoring
const successfulStrums = ref(0)
const totalAttempts = ref(0)
const accuracyPercentage = computed(() => {
  if (totalAttempts.value === 0) return 0
  return Math.round((successfulStrums.value / totalAttempts.value) * 100)
})

// Timeline window (show 8 beats worth)
const TIMELINE_WINDOW_BEATS = 8
const WINDOW_TOLERANCE_MS = 200 // Tolerance for strum timing

// Calculate playhead position (0-100%)
const playheadPosition = computed(() => {
  // Playhead is always at 50% (center)
  return 50
})

// Get visible strums (centered around current time)
const visibleStrums = computed<StrumSlot[]>(() => {
  if (!currentPattern.value || !metronome.isPlaying.value) return []

  const currentTime = metronome.elapsedTime.value
  const windowDuration = TIMELINE_WINDOW_BEATS * metronome.beatDuration.value

  return strumSlots.value.map(slot => {
    const strumTime = metronome.getStrumTime(slot.instruction.beat, slot.instruction.subdivision)
    const offset = strumTime - currentTime

    // Position relative to window (0-100%)
    const position = 50 + (offset / windowDuration) * 100

    // Determine status
    let status: 'past' | 'current' | 'future' = 'future'
    if (strumTime < currentTime - WINDOW_TOLERANCE_MS) {
      status = 'past'
    } else if (Math.abs(currentTime - strumTime) <= WINDOW_TOLERANCE_MS) {
      status = 'current'
    }

    return {
      ...slot,
      position,
      status
    }
  }).filter(slot => {
    // Only show strums within visible window
    return slot.position >= -10 && slot.position <= 110
  })
})

// Format strings for display
function formatStrings(strings: number[]): string {
  if (strings.length === 6) return 'All'
  if (strings.length === 1) return strings[0]?.toString() || ''
  return strings.join(',')
}

// Pattern change handler
function onPatternChange() {
  currentPattern.value = getPatternById(selectedPatternId.value)
  if (metronome.isPlaying.value) {
    resetPractice()
  }
}

// Initialize strum slots from pattern
function initializeStrumSlots() {
  if (!currentPattern.value) return

  strumSlots.value = currentPattern.value.strums.map(instruction => ({
    instruction,
    status: 'future',
    position: 0,
    result: undefined
  }))

  currentStrumIndex.value = 0
  currentStrumFeedback.value = null
  expectedDirection.value = strumSlots.value[0]?.instruction.direction || null
}

// Start practice
function startPractice() {
  initializeStrumSlots()
  strumDetector.clearBuffer()
  successfulStrums.value = 0
  totalAttempts.value = 0
  metronome.start()
}

// Stop practice
function stopPractice() {
  metronome.stop()
}

// Reset practice
function resetPractice() {
  metronome.reset()
  initializeStrumSlots()
  strumDetector.clearBuffer()
  successfulStrums.value = 0
  totalAttempts.value = 0
  currentStrumFeedback.value = null
}

// MIDI event handler
function handleMidiPluck(guitarString: number, timestamp: number) {
  if (!metronome.isPlaying.value || !currentPattern.value) return

  strumDetector.addEvent({ string: guitarString, timestamp })
}

// Main update loop
let updateIntervalId: number | null = null

function updateLoop() {
  if (!metronome.isPlaying.value || !currentPattern.value) return

  const currentTime = metronome.elapsedTime.value

  // Check for current strum
  if (currentStrumIndex.value < strumSlots.value.length) {
    const currentSlot = strumSlots.value[currentStrumIndex.value]
    if (!currentSlot) return

    const expectedTime = metronome.getStrumTime(
      currentSlot.instruction.beat,
      currentSlot.instruction.subdivision
    )

    // If we're in the timing window
    if (Math.abs(currentTime - expectedTime) <= WINDOW_TOLERANCE_MS) {
      expectedDirection.value = currentSlot.instruction.direction

      // Check if we have events to validate
      const events = strumDetector.getEventsInWindow(currentTime, WINDOW_TOLERANCE_MS * 2)

      if (events.length > 0) {
        // Validate the strum
        const result = strumDetector.validateStrum(events, currentSlot.instruction)

        currentSlot.result = result
        currentStrumFeedback.value = result

        if (result.valid) {
          successfulStrums.value++
        }
        totalAttempts.value++

        // Move to next strum
        currentStrumIndex.value++
        const nextSlot = strumSlots.value[currentStrumIndex.value]
        if (nextSlot) {
          expectedDirection.value = nextSlot.instruction.direction
        }

        // Clear the buffer after validation
        strumDetector.clearBuffer()
      }
    } else if (currentTime > expectedTime + WINDOW_TOLERANCE_MS) {
      // Missed this strum, move to next
      currentSlot.result = {
        direction: 'unclear',
        confidence: 0,
        stringsPlayed: new Set(),
        wrongStrings: [],
        missedStrings: Array.from(currentSlot.instruction.strings),
        valid: false
      }
      totalAttempts.value++
      currentStrumIndex.value++

      const nextSlot = strumSlots.value[currentStrumIndex.value]
      if (nextSlot) {
        expectedDirection.value = nextSlot.instruction.direction
      }
      strumDetector.clearBuffer()
    }
  }
}

// Setup MIDI listeners
onMounted(() => {
  // Listen to MIDI pluck events
  const { stringsPlucked } = sharedMidi

  watch(
    stringsPlucked,
    (newStrings) => {
      const timestamp = performance.now()
      newStrings.forEach(string => {
        handleMidiPluck(string, timestamp)
      })
    },
    { deep: true }
  )

  // Start update loop
  updateIntervalId = window.setInterval(updateLoop, 16) // ~60 FPS

  // Initialize pattern
  initializeStrumSlots()
})

onUnmounted(() => {
  if (updateIntervalId !== null) {
    clearInterval(updateIntervalId)
  }
  metronome.stop()
})
</script>

<style scoped>
.strumming-practice {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
}

h2 {
  text-align: center;
  margin-bottom: 20px;
}

/* Pattern Selection */
.pattern-selector {
  margin-bottom: 15px;
  text-align: center;
}

.pattern-selector label {
  margin-right: 10px;
  font-weight: bold;
}

.pattern-selector select {
  padding: 8px 12px;
  font-size: 16px;
  border: 2px solid #ddd;
  border-radius: 5px;
  min-width: 250px;
}

.pattern-info {
  text-align: center;
  margin-bottom: 20px;
}

.pattern-description {
  font-size: 14px;
  color: #666;
  margin: 5px 0;
}

.pattern-difficulty {
  font-size: 13px;
  margin: 5px 0;
}

.difficulty-beginner {
  color: #28a745;
  font-weight: bold;
}

.difficulty-intermediate {
  color: #ffc107;
  font-weight: bold;
}

.difficulty-advanced {
  color: #dc3545;
  font-weight: bold;
}

/* Metronome Controls */
.metronome-controls {
  background: #f5f5f5;
  padding: 20px;
  border-radius: 10px;
  margin-bottom: 20px;
}

.bpm-control {
  margin-bottom: 15px;
  text-align: center;
}

.bpm-control label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  font-size: 18px;
}

.bpm-control input[type="range"] {
  width: 100%;
  max-width: 400px;
}

.control-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.control-buttons button {
  padding: 10px 20px;
  font-size: 16px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-start {
  background: #28a745;
  color: white;
}

.btn-start:hover:not(:disabled) {
  background: #218838;
}

.btn-stop {
  background: #dc3545;
  color: white;
}

.btn-stop:hover:not(:disabled) {
  background: #c82333;
}

.btn-reset {
  background: #6c757d;
  color: white;
}

.btn-reset:hover {
  background: #5a6268;
}

.btn-click {
  background: #007bff;
  color: white;
}

.btn-click:hover {
  background: #0069d9;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Timeline */
.timeline-container {
  margin: 30px 0;
}

.timeline-header {
  text-align: center;
  margin-bottom: 15px;
}

.beat-indicator {
  font-size: 20px;
  font-weight: bold;
  color: #333;
}

.timeline {
  position: relative;
  height: 120px;
  background: linear-gradient(to bottom, #2c3e50 0%, #34495e 100%);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: inset 0 2px 10px rgba(0,0,0,0.3);
}

.timeline-track {
  position: relative;
  height: 100%;
}

/* Playhead */
.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #e74c3c;
  box-shadow: 0 0 10px rgba(231, 76, 60, 0.8);
  z-index: 10;
  transform: translateX(-50%);
}

/* Strum Markers */
.strum-marker {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  transition: all 0.3s;
}

.strum-icon {
  font-size: 32px;
  line-height: 1;
  margin-bottom: 5px;
  transition: all 0.3s;
}

.strum-strings {
  font-size: 11px;
  font-weight: bold;
  color: white;
  background: rgba(0,0,0,0.5);
  padding: 2px 6px;
  border-radius: 3px;
}

/* Strum States */
.strum-future .strum-icon {
  color: rgba(255, 255, 255, 0.5);
}

.strum-current .strum-icon {
  color: #f39c12;
  font-size: 40px;
  animation: pulse 0.5s ease-in-out infinite;
}

.strum-current.strum-emphasis .strum-icon {
  color: #e67e22;
  font-size: 44px;
}

.strum-past .strum-icon {
  color: rgba(255, 255, 255, 0.3);
  font-size: 24px;
}

.strum-success .strum-icon {
  color: #2ecc71 !important;
}

.strum-failure .strum-icon {
  color: #e74c3c !important;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

/* Feedback */
.strum-feedback {
  margin-top: 20px;
  padding: 15px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  text-align: center;
}

.feedback-success {
  background: #d4edda;
  color: #155724;
  border: 2px solid #c3e6cb;
}

.feedback-error {
  background: #f8d7da;
  color: #721c24;
  border: 2px solid #f5c6cb;
}

.feedback-error div {
  margin: 5px 0;
}

/* Score Display */
.score-display {
  display: flex;
  justify-content: center;
  gap: 40px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 10px;
  margin: 20px 0;
}

.score-item {
  text-align: center;
}

.score-label {
  display: block;
  font-size: 14px;
  color: #666;
  margin-bottom: 5px;
}

.score-value {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

/* Debug Panel */
.debug-panel {
  margin-top: 30px;
  padding: 15px;
  background: #f8f9fa;
  border: 1px solid #ddd;
  border-radius: 5px;
}

.debug-panel summary {
  cursor: pointer;
  font-weight: bold;
  user-select: none;
}

.debug-content {
  margin-top: 10px;
  font-family: monospace;
  font-size: 12px;
}

.debug-content p {
  margin: 5px 0;
}
</style>
