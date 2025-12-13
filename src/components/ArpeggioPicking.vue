<template>
  <div class="arpeggio-picking">
    <div class="header">
      <h1>Arpeggio Picking Practice</h1>
      <p class="subtitle">Practice fingerpicking patterns with common chords</p>
    </div>

    <!-- Audio Status -->
    <div v-if="!guitarSampler.isLoaded.value" class="status-card">
      <div v-if="guitarSampler.isLoading.value" class="loading">
        Loading guitar sounds...
      </div>
      <div v-else class="info">
        Click any chord to initialize audio
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
          <p><strong>Tempo:</strong> {{ bpm }} BPM</p>
          <p><strong>Time Signature:</strong> 4/4 (8 eighth notes per measure)</p>
        </div>
      </div>

      <div class="controls">
        <div class="tempo-control">
          <label for="tempo">Tempo (BPM):</label>
          <input
            id="tempo"
            v-model.number="bpm"
            type="range"
            min="40"
            max="200"
            step="5"
          />
          <span class="tempo-value">{{ bpm }}</span>
        </div>

        <div class="playback-controls">
          <button
            @click="playArpeggio"
            :disabled="isPlaying || !guitarSampler.isLoaded.value"
            class="btn btn-play"
          >
            {{ isPlaying ? 'Playing...' : 'Play Arpeggio' }}
          </button>

          <button
            @click="stopPlayback"
            :disabled="!isPlaying"
            class="btn btn-stop"
          >
            Stop
          </button>

          <button
            @click="playLoop"
            :disabled="isPlaying || !guitarSampler.isLoaded.value"
            class="btn btn-loop"
          >
            Loop (4 measures)
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
import { ref, computed } from 'vue'
import ChordCard from './ChordCard.vue'
import { useGuitarSampler } from '../composables/useGuitarSampler'
import * as Tone from 'tone'
import chordsData from '../data/chords.json'

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

// Initialize guitar sampler
const guitarSampler = useGuitarSampler()

// Chord data - filter for G, C, D, Em
const chords = computed<ChordData[]>(() => {
  const chordNames = ['G', 'C', 'D', 'Em']
  return (chordsData as ChordData[]).filter(chord => chordNames.includes(chord.name))
})

// Selected chord
const selectedChord = ref<ChordData | null>(null)

// Picking pattern: 5, 4, 2, 3, 1, 2, 3, 2 (8 eighth notes in 4/4 time)
const pickingPattern = [5, 4, 2, 3, 1, 2, 3, 2]

// Tempo control
const bpm = ref(80)

// Playback state
const isPlaying = ref(false)
const currentPlayingString = ref<number | null>(null)
const playbackProgress = ref(0)
let playbackSequence: number | null = null

/**
 * Select a chord
 */
async function selectChord(chord: ChordData): Promise<void> {
  selectedChord.value = chord

  // Initialize sampler and start audio context on first interaction
  if (!guitarSampler.isLoaded.value) {
    try {
      await guitarSampler.initializeSampler()
      await guitarSampler.startAudio()
      console.log('Audio initialized successfully')
    } catch (error) {
      console.error('Failed to initialize audio:', error)
    }
  }
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

/**
 * Play the arpeggio pattern once
 */
async function playArpeggio(): Promise<void> {
  if (!selectedChord.value || isPlaying.value) return

  // Ensure sampler is loaded and audio context is started
  try {
    if (!guitarSampler.isLoaded.value) {
      await guitarSampler.initializeSampler()
    }
    await guitarSampler.startAudio()
  } catch (error) {
    console.error('Failed to initialize audio:', error)
    return
  }

  isPlaying.value = true
  playbackProgress.value = 0

  // Set Tone.js transport BPM
  Tone.Transport.bpm.value = bpm.value

  // Schedule the arpeggio pattern
  const pattern = pickingPattern
  const totalNotes = pattern.length

  // Create a Tone.js Part to schedule notes
  const part = new Tone.Part((time, value) => {
    const stringNum = value.string
    const fret = getFretForString(stringNum)

    // Play the note
    guitarSampler.playString(stringNum, fret, '8n')

    // Update UI (schedule UI update slightly ahead for visual feedback)
    Tone.Draw.schedule(() => {
      currentPlayingString.value = stringNum
      playbackProgress.value = (value.index + 1) / totalNotes * 100
    }, time)
  }, pattern.map((string, index) => ({
    time: `0:0:${index}`, // Each note on successive 8th notes
    string,
    index
  })))

  // Start at beginning
  part.start(0)
  part.loop = false

  // Start transport
  Tone.Transport.start()

  // Stop after pattern completes
  const patternDuration = (60 / bpm.value) * 2 // 2 beats = 4 eighth notes = full measure in 4/4
  setTimeout(() => {
    Tone.Transport.stop()
    part.dispose()
    isPlaying.value = false
    currentPlayingString.value = null
    playbackProgress.value = 0
  }, patternDuration * 1000)
}

/**
 * Play the arpeggio in a loop (4 measures)
 */
async function playLoop(): Promise<void> {
  if (!selectedChord.value || isPlaying.value) return

  // Ensure sampler is loaded and audio context is started
  try {
    if (!guitarSampler.isLoaded.value) {
      await guitarSampler.initializeSampler()
    }
    await guitarSampler.startAudio()
  } catch (error) {
    console.error('Failed to initialize audio:', error)
    return
  }

  isPlaying.value = true
  playbackProgress.value = 0

  // Set Tone.js transport BPM
  Tone.Transport.bpm.value = bpm.value

  const pattern = pickingPattern
  const totalNotes = pattern.length

  // Create a repeating pattern
  const part = new Tone.Part((time, value) => {
    const stringNum = value.string
    const fret = getFretForString(stringNum)

    guitarSampler.playString(stringNum, fret, '8n')

    Tone.Draw.schedule(() => {
      currentPlayingString.value = stringNum
      const currentLoop = Math.floor(value.absoluteIndex / totalNotes)
      const noteInLoop = value.absoluteIndex % totalNotes
      playbackProgress.value = ((currentLoop * totalNotes) + noteInLoop + 1) / (totalNotes * 4) * 100
    }, time)
  }, pattern.map((string, index) => ({
    time: `0:0:${index}`,
    string,
    index,
    absoluteIndex: index
  })))

  part.start(0)
  part.loop = 4 // Loop 4 times
  part.loopEnd = '2n' // Each loop is 2 quarter notes (1 measure in our pattern)

  // Manually track loop iterations for UI
  let loopCount = 0
  const loopDuration = (60 / bpm.value) * 2 // Duration of one measure

  const updateLoop = () => {
    loopCount++
    if (loopCount < 4) {
      playbackSequence = window.setTimeout(updateLoop, loopDuration * 1000)
    }
  }

  Tone.Transport.start()

  // Update loop counter
  playbackSequence = window.setTimeout(updateLoop, loopDuration * 1000)

  // Stop after 4 loops
  setTimeout(() => {
    Tone.Transport.stop()
    part.dispose()
    isPlaying.value = false
    currentPlayingString.value = null
    playbackProgress.value = 0
    if (playbackSequence !== null) {
      clearTimeout(playbackSequence)
      playbackSequence = null
    }
  }, loopDuration * 4 * 1000)
}

/**
 * Stop current playback
 */
function stopPlayback(): void {
  Tone.Transport.stop()
  Tone.Transport.cancel() // Cancel all scheduled events
  guitarSampler.stopAll()
  isPlaying.value = false
  currentPlayingString.value = null
  playbackProgress.value = 0

  if (playbackSequence !== null) {
    clearTimeout(playbackSequence)
    playbackSequence = null
  }
}
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
