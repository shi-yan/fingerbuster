<template>
  <div class="arpeggio-picking">
    <div class="header">
      <h1>Arpeggio Picking Practice</h1>
      <p class="subtitle">Practice fingerpicking patterns with common chords</p>
    </div>

    <p v-if="audioError" role="alert">{{ audioError }}</p>

    <!-- Audio Status -->
    <div v-if="guitarSampler.isLoading.value" class="status-card">
      <div class="loading">
        Loading guitar sounds...
      </div>
    </div>

    <!-- Chord Cards Grid -->
    <div class="chord-grid">
      <ChordCard
        v-for="chord in chords"
        :key="chord.name"
        :chord-data="chord"
        :is-selected="selectedChord?.name === chord.name"
        :picking-pattern="selectedChord?.name === chord.name ? pickingPattern : undefined"
        @select="selectChord(chord)"
      />
    </div>

    <!-- Control Panel (shown when chord is selected) -->
    <div v-if="selectedChord" class="control-panel">
      <div class="pattern-info">
        <h3>{{ selectedChord.name }} Chord Arpeggio</h3>
        <div class="pattern-description">
          <p><strong>Picking Pattern:</strong> {{ pickingPattern.join('-') }}</p>
          <p><strong>Description:</strong> {{ selectedPattern?.description || 'Your custom string sequence' }}</p>
          <p><strong>Tempo:</strong> {{ bpm }} BPM</p>
          <p><strong>Rhythm:</strong> One eighth note per digit ({{ pickingPattern.length }} notes per repeat)</p>
        </div>
      </div>

      <div class="controls">
        <div class="pattern-selector">
          <label for="pattern">Picking Pattern:</label>
          <select
            id="pattern"
            v-model="selectedPatternId"
            :disabled="isPlaying || guitarSampler.isLoading.value"
            class="pattern-select"
          >
            <option
              v-for="pattern in pickingPatterns"
              :key="pattern.id"
              :value="pattern.id"
            >
              {{ pattern.name }}
            </option>
            <option value="custom">Custom pattern…</option>
          </select>
        </div>

        <div v-if="selectedPatternId === 'custom'" class="pattern-selector">
          <label for="custom-pattern">String sequence:</label>
          <input
            id="custom-pattern"
            v-model="customPattern"
            class="pattern-select"
            placeholder="53231323"
            maxlength="96"
            :disabled="isPlaying || guitarSampler.isLoading.value"
            :aria-invalid="!!patternError"
            aria-describedby="pattern-help pattern-error"
          />
        </div>
        <p id="pattern-help">1 = thinnest string (high E), 6 = thickest (low E). Enter 1–32 notes; spaces and hyphens are optional.</p>
        <p id="pattern-error" role="status">{{ patternError }}</p>

        <div class="tempo-control">
          <label for="tempo">Tempo (BPM):</label>
          <input
            id="tempo"
            v-model.number="bpm"
            type="range"
            min="40"
            max="200"
            step="5"
            :disabled="isPlaying || guitarSampler.isLoading.value"
          />
          <span class="tempo-value">{{ bpm }}</span>
        </div>

        <div class="playback-controls">
          <button class="btn btn-play" :disabled="isPlaying || guitarSampler.isLoading.value" @click="playStrum('down')">
            ↓ Strum Down
          </button>
          <button class="btn btn-play" :disabled="isPlaying || guitarSampler.isLoading.value" @click="playStrum('up')">
            ↑ Strum Up
          </button>
          <button
            @click="playArpeggio"
            :disabled="!selectedChord || !!patternError || isPlaying || guitarSampler.isLoading.value"
            class="btn btn-play"
          >
            {{ isPlaying ? 'Playing...' : guitarSampler.isLoading.value ? 'Loading...' : 'Play Arpeggio' }}
          </button>

          <button
            @click="stopPlayback"
            class="btn btn-stop"
          >
            Stop
          </button>

          <button
            @click="playLoop"
            :disabled="!selectedChord || !!patternError || isPlaying || guitarSampler.isLoading.value"
            class="btn btn-loop"
          >
            {{ guitarSampler.isLoading.value ? 'Loading...' : 'Loop (4 repeats)' }}
          </button>
        </div>
      </div>

      <!-- Visual feedback during playback -->
      <div v-if="isPlaying" class="playback-visualization">
        <div class="current-note">
          Playing string: <span class="note-highlight">{{ currentPlayingString }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${playbackProgress}%` }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import ChordCard from './ChordCard.vue'
import { useGuitarSampler } from '../composables/useGuitarSampler'
import chordsData from '../data/chords.json'

// localStorage keys
const STORAGE_KEY_CHORD = 'arpeggio-selected-chord'
const STORAGE_KEY_PATTERN = 'arpeggio-selected-pattern'
const STORAGE_KEY_CUSTOM_PATTERN = 'arpeggio-custom-pattern'

interface ChordStringData {
  play: boolean
  fret: number
  finger: number
}

interface ChordData {
  name: string
  string_1: ChordStringData
  string_2: ChordStringData
  string_3: ChordStringData
  string_4: ChordStringData
  string_5: ChordStringData
  string_6: ChordStringData
}

interface PickingPattern {
  id: string
  name: string
  pattern: number[]
  description: string
}

// Initialize guitar sampler
const guitarSampler = useGuitarSampler()

// Chord data - filter for the arpeggio practice chords
const chords = computed<ChordData[]>(() => {
  const chordNames = ['Galt', 'C', 'D', 'Em', 'Cadd9', 'Am7', 'Em7']
  return (chordsData as ChordData[]).filter(chord => chordNames.includes(chord.name))
})

// Selected chord
const selectedChord = ref<ChordData | null>(null)

// Available picking patterns
const pickingPatterns: PickingPattern[] = [
  {
    id: 'fingerstyle5',
    name: '53231323 — 5th-string bass',
    pattern: [5, 3, 2, 3, 1, 3, 2, 3],
    description: 'Alternating bass and treble, starting on string 5'
  },
  {
    id: 'fingerstyle6',
    name: '63231323 — 6th-string bass',
    pattern: [6, 3, 2, 3, 1, 3, 2, 3],
    description: 'The same fingerpicking motion with a low 6th-string bass'
  },
  {
    id: 'fingerstyle4',
    name: '43231323 — 4th-string bass',
    pattern: [4, 3, 2, 3, 1, 3, 2, 3],
    description: 'Start on string 4 for chords such as D'
  },
  {
    id: 'pattern1',
    name: 'Pattern 1 (Bass-Mid-High)',
    pattern: [5, 4, 2, 3, 1, 2, 3, 2],
    description: 'Start from 5th string, descend to bass, then treble'
  },
  {
    id: 'pattern2',
    name: 'Pattern 2 (Bass-High-Mid)',
    pattern: [6, 4, 2, 3, 1, 2, 3, 2],
    description: 'Start from 6th string, classic bass-treble pattern'
  }
]

// Selected pattern
const selectedPatternId = ref('fingerstyle5')
const customPattern = ref('53231323')
const selectedPattern = computed(() => {
  if (selectedPatternId.value === 'custom') return undefined
  const pattern = pickingPatterns.find(p => p.id === selectedPatternId.value)
  return pattern || pickingPatterns[0]
})
const pickingPattern = computed(() => {
  if (selectedPatternId.value === 'custom') {
    const digits = customPattern.value.replace(/[\s-]/g, '')
    return /^[1-6]{1,32}$/.test(digits) ? Array.from(digits, Number) : []
  }
  const pattern = selectedPattern.value
  return pattern ? pattern.pattern : pickingPatterns[0]!.pattern
})
const patternError = computed(() => {
  if (!pickingPattern.value.length) return 'Enter 1–32 string numbers from 1 to 6.'
  const chord = selectedChord.value
  if (!chord) return ''
  const muted = [...new Set(pickingPattern.value)].filter(string =>
    !(chord[`string_${string}` as keyof ChordData] as ChordStringData).play
  )
  return muted.length
    ? `${chord.name} mutes string${muted.length > 1 ? 's' : ''} ${muted.join(', ')}. Choose another pattern or edit the sequence.`
    : ''
})

// Tempo control
const bpm = ref(80)

// Playback state
const isPlaying = ref(false)
const audioError = ref('')
let playbackRequest = 0
const currentPlayingString = ref<number | null>(null)
const playbackProgress = ref(0)

/**
 * Load saved selections from localStorage on mount
 */
onMounted(() => {
  // Restore selected pattern
  const savedPatternId = localStorage.getItem(STORAGE_KEY_PATTERN)
  if (savedPatternId && (savedPatternId === 'custom' || pickingPatterns.some(p => p.id === savedPatternId))) {
    selectedPatternId.value = savedPatternId
  }
  const savedCustom = localStorage.getItem(STORAGE_KEY_CUSTOM_PATTERN)
  if (savedCustom !== null) customPattern.value = savedCustom

  // Restore selected chord
  const savedChordName = localStorage.getItem(STORAGE_KEY_CHORD)
  if (savedChordName) {
    const chord = chords.value.find(c => c.name === savedChordName)
    if (chord) {
      selectedChord.value = chord
      console.log(`✅ Restored chord selection from localStorage: ${savedChordName}`)
    }
  }
})

/**
 * Watch for changes to selected chord and save to localStorage
 */
watch(selectedChord, (newChord) => {
  if (newChord) {
    localStorage.setItem(STORAGE_KEY_CHORD, newChord.name)
    console.log(`💾 Saved chord selection to localStorage: ${newChord.name}`)
  } else {
    localStorage.removeItem(STORAGE_KEY_CHORD)
  }
})

/**
 * Watch for changes to selected pattern and save to localStorage
 */
watch(selectedPatternId, (newPatternId) => {
  localStorage.setItem(STORAGE_KEY_PATTERN, newPatternId)
  console.log(`💾 Saved pattern selection to localStorage: ${newPatternId}`)
})
watch(customPattern, value => localStorage.setItem(STORAGE_KEY_CUSTOM_PATTERN, value))

/**
 * Select a chord
 */
function selectChord(chord: ChordData): void {
  stopPlayback()
  selectedChord.value = chord
  // Don't initialize audio here - wait for play button click
}

/**
 * Get fret for a specific string in the selected chord
 */
function getFretForString(stringNum: number): number {
  if (!selectedChord.value) return 0

  const stringKey = `string_${stringNum}` as keyof ChordData
  const stringData = selectedChord.value[stringKey] as ChordStringData
  return stringData.fret
}

// Pending UI updates for the current playback, so Stop can cancel them
let uiTimers: number[] = []

async function playStrum(direction: 'down' | 'up'): Promise<void> {
  const chord = selectedChord.value
  if (!chord || isPlaying.value) return
  const request = ++playbackRequest
  audioError.value = ''
  try {
    await guitarSampler.ensureReady()
    if (request !== playbackRequest) return
    const strings = Array.from({ length: 6 }, (_, i) => {
      const string = i + 1
      const note = chord[`string_${string}` as keyof ChordData] as ChordStringData
      return { string, fret: note.fret, play: note.play }
    }).filter(note => note.play)
    guitarSampler.playChord(strings, { direction, velocity: 0.75 })
  } catch {
    if (request === playbackRequest) audioError.value = 'Could not load guitar sounds. Check your connection and try again.'
  }
}

function clearUiTimers(): void {
  uiTimers.forEach(id => clearTimeout(id))
  uiTimers = []
}

/**
 * Schedule the selected pattern `loops` times on the audio clock. Audio timing
 * comes from the AudioContext (sample-accurate); setTimeout only drives the UI.
 */
async function startPlayback(loops: number): Promise<void> {
  if (!selectedChord.value || isPlaying.value || patternError.value) return

  const request = ++playbackRequest
  audioError.value = ''
  try {
    await guitarSampler.ensureReady()
  } catch (error) {
    if (request === playbackRequest) audioError.value = 'Could not load guitar sounds. Check your connection and try again.'
    console.error('❌ Failed to start audio:', error)
    return
  }
  if (request !== playbackRequest) return

  guitarSampler.stopAll()
  isPlaying.value = true
  playbackProgress.value = 0
  clearUiTimers()

  const pattern = pickingPattern.value
  const totalNotes = pattern.length * loops
  const noteInterval = (60 / bpm.value) / 2 // eighth note, in seconds
  const startTime = guitarSampler.currentTime() + 0.08

  for (let i = 0; i < totalNotes; i++) {
    const stringNum = pattern[i % pattern.length]!
    const when = startTime + i * noteInterval
    // Thumb-played bass strings land a little heavier than the fingers
    const velocity = stringNum >= 4 ? 0.72 : 0.6
    guitarSampler.playString(stringNum, getFretForString(stringNum), { when, velocity, fingers: true })

    const delayMs = (when - guitarSampler.currentTime()) * 1000
    uiTimers.push(window.setTimeout(() => {
      currentPlayingString.value = stringNum
      playbackProgress.value = (i + 1) / totalNotes * 100
    }, delayMs))
  }

  // The chord keeps ringing naturally after the last note; just reset the UI
  const endMs = (startTime + totalNotes * noteInterval - guitarSampler.currentTime()) * 1000
  uiTimers.push(window.setTimeout(() => {
    isPlaying.value = false
    currentPlayingString.value = null
    playbackProgress.value = 0
    uiTimers = []
  }, endMs + 300))
}

/**
 * Play the arpeggio pattern once
 */
function playArpeggio(): Promise<void> {
  return startPlayback(1)
}

/**
 * Play the arpeggio in a loop (4 repeats)
 */
function playLoop(): Promise<void> {
  return startPlayback(4)
}

/**
 * Stop current playback, including notes already scheduled
 */
function stopPlayback(): void {
  playbackRequest++
  guitarSampler.stopAll()
  clearUiTimers()
  isPlaying.value = false
  currentPlayingString.value = null
  playbackProgress.value = 0
}

onUnmounted(stopPlayback)
</script>

<style scoped>
.arpeggio-picking {
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2rem;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 1rem;
  color: #6b7280;
}

.status-card {
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 2rem;
  text-align: center;
}

.loading {
  color: #92400e;
  font-weight: 600;
}

.info {
  color: #78350f;
}

.chord-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
  justify-items: center;
}

.control-panel {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.pattern-info {
  margin-bottom: 2rem;
}

.pattern-info h3 {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 1rem;
}

.pattern-description {
  color: #4b5563;
}

.pattern-description p {
  margin: 0.5rem 0;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.pattern-selector {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.pattern-selector label {
  font-weight: 600;
  color: #374151;
  min-width: 120px;
}

.pattern-select {
  flex: 1;
  padding: 0.5rem;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-size: 0.9375rem;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.pattern-select:hover:not(:disabled) {
  border-color: #3b82f6;
}

.pattern-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tempo-control {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.tempo-control label {
  font-weight: 600;
  color: #374151;
  min-width: 120px;
}

.tempo-control input[type="range"] {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: #e5e7eb;
  outline: none;
}

.tempo-control input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
}

.tempo-control input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: none;
}

.tempo-value {
  font-weight: bold;
  color: #1f2937;
  min-width: 60px;
  text-align: right;
}

.playback-controls {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  min-width: 150px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-play {
  background-color: #10b981;
  color: white;
}

.btn-play:hover:not(:disabled) {
  background-color: #059669;
}

.btn-stop {
  background-color: #ef4444;
  color: white;
}

.btn-stop:hover:not(:disabled) {
  background-color: #dc2626;
}

.btn-loop {
  background-color: #3b82f6;
  color: white;
}

.btn-loop:hover:not(:disabled) {
  background-color: #2563eb;
}

.playback-visualization {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e5e7eb;
}

.current-note {
  text-align: center;
  font-size: 1.25rem;
  margin-bottom: 1rem;
  color: #374151;
}

.note-highlight {
  display: inline-block;
  padding: 0.5rem 1rem;
  background-color: #3b82f6;
  color: white;
  border-radius: 8px;
  font-weight: bold;
  min-width: 60px;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #3b82f6;
  transition: width 0.1s linear;
}
</style>
