<template>
  <div class="fretboard-container card">
    <div class="header-section">
      <h2>Fretboard</h2>

      <!-- Chord selection buttons -->
      <div class="chord-buttons">
        <button
          v-for="chordName in Object.keys(chords)"
          :key="chordName"
          @click="selectChord(chordName)"
          class="chord-button"
          :class="{ active: selectedChord === chordName }"
        >
          {{ chordName }}
        </button>
        <button
          @click="clearChord"
          class="chord-button clear-button"
          :class="{ active: selectedChord === null }"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Fretboard visualization -->
    <div class="fretboard">
      <div class="fretboard-inner">
        <!-- Fret markers (top) -->
        <div class="fret-markers">
          <div class="play-indicator-spacer"></div>
          <div class="string-label-spacer"></div>
          <div
            v-for="fret in 12"
            :key="`marker-${fret}`"
            class="fret-marker"
            :style="{ width: fretWidth + 'px' }"
          >
            {{ fret }}
          </div>
        </div>

        <!-- Strings and frets -->
        <div class="strings-container">
          <div
            v-for="string in 6"
            :key="`string-${string}`"
            class="string-row"
          >
            <!-- Play indicator (X or O) -->
            <div class="play-indicator">
              <span
                v-if="currentChord"
                :class="getPlayIndicatorClass(string)"
              >
                {{ getPlayIndicator(string) }}
              </span>
            </div>

            <!-- String number label -->
            <div class="string-label">
              <span>
                {{ getStringName(string) }}
              </span>
            </div>

            <!-- Frets -->
            <div class="frets-row">
              <!-- String line -->
              <div
                class="string-line"
                :style="{ width: (fretWidth * 12) + 'px' }"
              ></div>

              <!-- Barre indicator (shown on the strings covered by the barre) -->
              <div
                v-if="currentChord && currentChord.barre && string >= currentChord.barre.endString && string <= currentChord.barre.startString"
                class="barre-indicator"
                :class="getFingerColorClass(string, currentChord.barre.fret)"
                :style="{
                  left: ((currentChord.barre.fret - 1) * fretWidth + fretWidth / 2) + 'px',
                  width: '48px',
                  height: string === currentChord.barre.endString ? `${((currentChord.barre.startString - currentChord.barre.endString) * 40 + (currentChord.barre.startString - currentChord.barre.endString) * 12)}px` : '0px',
                  zIndex: string === currentChord.barre.endString ? 9 : 0
                }"
              >
                <span v-if="string === currentChord.barre.endString">{{ currentChord.barre.finger }}</span>
              </div>

              <!-- Frets -->
              <div
                v-for="fret in 12"
                :key="`fret-${string}-${fret}`"
                class="fret-cell"
                :style="{ width: fretWidth + 'px' }"
              >
                <!-- Fret line -->
                <div
                  class="fret-line"
                  :class="{ 'last-fret': fret === 12 }"
                ></div>

                <!-- User finger position (gray semi-transparent) -->
                <div
                  v-if="isStringFretPressed(string, fret) && !isChordPosition(string, fret)"
                  class="user-finger-indicator"
                >
                </div>

                <!-- Chord position indicator (with finger number label) -->
                <div
                  v-if="isChordPosition(string, fret)"
                  class="chord-indicator"
                  :class="getFingerColorClass(string, fret)"
                >
                  <span>{{ getFingerNumber(string, fret) }}</span>
                </div>

                <!-- User finger on chord position (show both) -->
                <div
                  v-if="isStringFretPressed(string, fret) && isChordPosition(string, fret)"
                  class="user-finger-on-chord"
                >
                </div>

                <!-- Inlay markers -->
                <div
                  v-if="shouldShowInlay(fret) && string === 4"
                  class="inlay-marker"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Nut (left edge) -->
        <div class="nut"></div>
      </div>
    </div>

    <!-- Finger color legend -->
    <div v-if="currentChord" class="finger-legend">
      <h3>Finger Colors:</h3>
      <div class="legend-items">
        <div class="legend-item">
          <div class="legend-dot finger-thumb"></div>
          <span>Thumb (T)</span>
        </div>
        <div class="legend-item">
          <div class="legend-dot finger-index"></div>
          <span>Index (1)</span>
        </div>
        <div class="legend-item">
          <div class="legend-dot finger-middle"></div>
          <span>Middle (2)</span>
        </div>
        <div class="legend-item">
          <div class="legend-dot finger-ring"></div>
          <span>Ring (3)</span>
        </div>
        <div class="legend-item">
          <div class="legend-dot finger-pinky"></div>
          <span>Pinky (4)</span>
        </div>
      </div>
    </div>

    <!-- Current finger positions display -->
    <div class="positions-display">
      <h3>Current Finger Positions:</h3>
      <div class="positions-grid">
        <div v-if="fretPositions.size === 0" class="empty-message">
          No strings pressed
        </div>
        <div v-else class="positions-list">
          <div
            v-for="[string, fretSet] in Array.from(fretPositions.entries())"
            :key="`position-${string}`"
            class="position-item"
          >
            <span class="position-string">{{ getStringName(string) }}:</span>
            <span class="position-fret">Frets {{ Array.from(fretSet).sort((a, b) => a - b).join(', ') }} (using {{ Math.max(...Array.from(fretSet)) }})</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import chordsData from '../data/chords.json'

interface Props {
  fretPositions: Map<number, Set<number>>
  selectedChord?: string | null  // Optional: for practice mode
  stringStatus?: Map<number, 'correct' | 'wrong' | 'unplayed'>  // Optional: for practice mode string visualization
}

interface ChordPosition {
  fret: number
  finger: number
}

interface BarreInfo {
  fret: number
  startString: number
  endString: number
  finger: number
}

interface Chord {
  name: string
  positions: (ChordPosition | 'x' | null)[] // null = open string (0), 'x' = don't play
  barre?: BarreInfo
}

interface ChordStringData {
  play: boolean
  fret: number
  finger: number
}

interface ChordJson {
  name: string
  barre?: {
    fret: number
    startString: number
    endString: number
    finger: number
  }
  string_1: ChordStringData
  string_2: ChordStringData
  string_3: ChordStringData
  string_4: ChordStringData
  string_5: ChordStringData
  string_6: ChordStringData
}

const props = defineProps<Props>()

const fretWidth = 80

// String names from 1st (high e) to 6th (low E)
const stringNames = ['e', 'B', 'G', 'D', 'A', 'E']

// Convert JSON chord data to internal format
const convertChordData = (jsonChord: ChordJson): Chord => {
  const stringData = [
    jsonChord.string_1,
    jsonChord.string_2,
    jsonChord.string_3,
    jsonChord.string_4,
    jsonChord.string_5,
    jsonChord.string_6
  ]

  const positions = stringData.map(str => {
    if (!str.play) return 'x'
    if (str.fret === 0) return null
    return { fret: str.fret, finger: str.finger }
  })

  const chord: Chord = {
    name: jsonChord.name,
    positions: positions as (ChordPosition | 'x' | null)[]
  }

  if (jsonChord.barre) {
    chord.barre = jsonChord.barre
  }

  return chord
}

// Load chords from JSON
const chords: Record<string, Chord> = {}
chordsData.forEach((jsonChord: ChordJson) => {
  chords[jsonChord.name] = convertChordData(jsonChord)
})

const internalSelectedChord = ref<string | null>(null)

// Use prop if provided, otherwise use internal state
const selectedChord = computed(() => {
  return props.selectedChord !== undefined ? props.selectedChord : internalSelectedChord.value
})

const currentChord = computed(() => {
  return selectedChord.value ? chords[selectedChord.value] : null
})

const selectChord = (chordName: string) => {
  // Only update internal state if not controlled by prop
  if (props.selectedChord === undefined) {
    internalSelectedChord.value = chordName
  }
}

const clearChord = () => {
  // Only update internal state if not controlled by prop
  if (props.selectedChord === undefined) {
    internalSelectedChord.value = null
  }
}

const getStringName = (stringNumber: number): string => {
  if (stringNumber >= 1 && stringNumber <= 6) {
    return `${stringNumber} (${stringNames[stringNumber - 1]})`
  }
  return `${stringNumber}`
}

const getPlayIndicator = (stringNumber: number): string => {
  if (!currentChord.value) return ''
  const position = currentChord.value.positions[stringNumber - 1]
  if (position === 'x') return 'X'
  return 'O'
}

const getPlayIndicatorClass = (stringNumber: number): string => {
  if (!props.stringStatus) return ''
  const status = props.stringStatus.get(stringNumber)
  if (status === 'correct') return 'indicator-correct'
  if (status === 'wrong') return 'indicator-wrong'
  if (status === 'unplayed') return 'indicator-unplayed'
  return ''
}

const isChordPosition = (string: number, fret: number): boolean => {
  if (!currentChord.value) return false
  const position = currentChord.value.positions[string - 1]
  if (!position || position === 'x') return false
  return (position as ChordPosition).fret === fret
}

const getFingerNumber = (string: number, _fret: number): number => {
  if (!currentChord.value) return 0
  const position = currentChord.value.positions[string - 1]
  if (!position || position === 'x') return 0
  return (position as ChordPosition).finger
}

const getFingerColorClass = (string: number, _fret: number): string => {
  if (!currentChord.value) return ''
  const position = currentChord.value.positions[string - 1]
  if (!position || position === 'x') return ''

  const finger = (position as ChordPosition).finger
  switch (finger) {
    case 0: return 'finger-thumb'
    case 1: return 'finger-index'
    case 2: return 'finger-middle'
    case 3: return 'finger-ring'
    case 4: return 'finger-pinky'
    default: return ''
  }
}

const isStringFretPressed = (string: number, fret: number): boolean => {
  const fretSet = props.fretPositions.get(string)
  return fretSet ? fretSet.has(fret) : false
}

const shouldShowInlay = (fret: number): boolean => {
  return [3, 5, 7, 9].includes(fret) || fret === 12
}
</script>

<style scoped>
.fretboard-container {
  max-width: 1200px;
  margin: 0 auto;
}

.header-section {
  margin-bottom: 1.5rem;
}

.fretboard-container h2 {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
  text-align: center;
  margin-bottom: 1rem;
}

.chord-buttons {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.chord-button {
  padding: 0.5rem 1rem;
  background-color: #e5e7eb;
  color: #1f2937;
  border: 2px solid transparent;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.chord-button:hover {
  background-color: #d1d5db;
}

.chord-button.active {
  background-color: #4f46e5;
  color: white;
  border-color: #4338ca;
}

.chord-button.clear-button.active {
  background-color: #6b7280;
  border-color: #4b5563;
}

.fretboard {
  position: relative;
  background-color: #b45309;
  border-radius: 8px;
  padding: 1.5rem;
  overflow-x: auto;
}

.fretboard-inner {
  min-width: max-content;
}

.fret-markers {
  display: flex;
  margin-bottom: 0.5rem;
}

.string-label-spacer {
  width: 64px;
  flex-shrink: 0;
}

.play-indicator-spacer {
  width: 32px;
  flex-shrink: 0;
}

.fret-marker {
  flex-shrink: 0;
  text-align: center;
  font-size: 0.75rem;
  color: #fef3c7;
  font-weight: 600;
}

.strings-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.string-row {
  display: flex;
  align-items: center;
}

.string-label {
  width: 64px;
  flex-shrink: 0;
  text-align: right;
  padding-right: 1rem;
}

.string-label span {
  font-size: 0.875rem;
  font-weight: bold;
  color: #fef3c7;
}

.play-indicator {
  width: 32px;
  flex-shrink: 0;
  text-align: center;
}

.play-indicator span {
  font-size: 1.25rem;
  font-weight: bold;
  color: #fef3c7;
}

.play-indicator span.indicator-correct {
  color: #22c55e;
  text-shadow: 0 0 5px rgba(34, 197, 94, 0.5);
}

.play-indicator span.indicator-wrong {
  color: #ef4444;
  text-shadow: 0 0 5px rgba(239, 68, 68, 0.5);
}

.play-indicator span.indicator-unplayed {
  color: #9ca3af;
}

.frets-row {
  display: flex;
  align-items: center;
  position: relative;
}

.string-line {
  position: absolute;
  height: 2px;
  background-color: #d1d5db;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
}

.fret-cell {
  flex-shrink: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
}

.fret-line {
  position: absolute;
  right: 0;
  width: 4px;
  height: 100%;
  background-color: #9ca3af;
}

.fret-line.last-fret {
  background-color: #d1d5db;
}

/* User finger position - gray semi-transparent */
.user-finger-indicator {
  width: 32px;
  height: 32px;
  background-color: rgba(107, 114, 128, 0.5);
  border-radius: 50%;
  border: 2px solid rgba(107, 114, 128, 0.7);
  z-index: 5;
  position: absolute;
}

/* Chord position - with finger number */
.chord-indicator {
  width: 32px;
  height: 32px;
  background-color: #3b82f6;
  border-radius: 50%;
  border: 4px solid white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chord-indicator span {
  font-size: 0.875rem;
  font-weight: bold;
  color: white;
}

/* Finger-specific colors */
.chord-indicator.finger-thumb {
  background-color: #78716c;
}

.chord-indicator.finger-index {
  background-color: #3b82f6;
}

.chord-indicator.finger-middle {
  background-color: #10b981;
}

.chord-indicator.finger-ring {
  background-color: #f59e0b;
}

.chord-indicator.finger-pinky {
  background-color: #a855f7;
}

/* User finger on chord position - green highlight behind chord */
.user-finger-on-chord {
  width: 44px;
  height: 44px;
  background-color: rgba(34, 197, 94, 0.3);
  border-radius: 50%;
  border: 5px solid rgba(34, 197, 94, 0.9);
  z-index: 8;
  position: absolute;
  box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
}

/* Barre indicator - horizontal bar connecting multiple strings */
.barre-indicator {
  position: absolute;
  border-radius: 24px;
  border: 3px solid white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.barre-indicator span {
  font-size: 1rem;
  font-weight: bold;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.inlay-marker {
  position: absolute;
  width: 12px;
  height: 12px;
  background-color: #fde68a;
  border-radius: 50%;
  opacity: 0.5;
}

.nut {
  position: absolute;
  left: 96px;
  top: 48px;
  width: 8px;
  background-color: #1f2937;
  border-radius: 2px;
  height: calc(100% - 96px);
}

.positions-display {
  margin-top: 1.5rem;
}

.positions-display h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

.positions-grid {
  background-color: #f3f4f6;
  padding: 1rem;
  border-radius: 8px;
}

.empty-message {
  color: #9ca3af;
  font-style: italic;
}

.positions-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.5rem;
}

.position-item {
  background: white;
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid #d1d5db;
}

.position-string {
  font-weight: 600;
}

.position-fret {
  margin-left: 0.5rem;
  color: #2563eb;
}

/* Finger legend */
.finger-legend {
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.finger-legend h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.75rem;
}

.legend-items {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 3px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.legend-dot.finger-thumb {
  background-color: #78716c;
}

.legend-dot.finger-index {
  background-color: #3b82f6;
}

.legend-dot.finger-middle {
  background-color: #10b981;
}

.legend-dot.finger-ring {
  background-color: #f59e0b;
}

.legend-dot.finger-pinky {
  background-color: #a855f7;
}

.legend-item span {
  font-size: 0.875rem;
  color: #4b5563;
  font-weight: 500;
}
</style>
