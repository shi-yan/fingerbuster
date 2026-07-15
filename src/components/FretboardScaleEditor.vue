<template>
  <div class="scale-editor-container card">
    <div class="header-section no-print">
      <h2>Fretboard Scale Editor</h2>
      <p class="subtitle">Left-click a fret to mark it and hear the note. Right-click a marked fret to remove it.</p>
      <p v-if="guitarSampler.isLoading.value" class="loading-note">Loading guitar sounds...</p>
    </div>

    <!-- Controls -->
    <div class="controls no-print">
      <div class="control-group">
        <label for="capo-select">Capo</label>
        <select id="capo-select" v-model.number="capo" class="control-input">
          <option v-for="c in 13" :key="c - 1" :value="c - 1">
            {{ c - 1 === 0 ? 'None' : `Fret ${c - 1}` }}
          </option>
        </select>
      </div>

      <div class="control-group">
        <label for="load-select">Load</label>
        <select id="load-select" v-model="selectedLoadKey" class="control-input" @change="handleLoadChange">
          <option value="">-- Select a preset or save --</option>
          <optgroup label="Presets">
            <option v-for="preset in presets" :key="preset.id" :value="`preset:${preset.id}`">
              {{ preset.name }}
            </option>
          </optgroup>
          <optgroup v-if="dbSaves.length > 0" label="My Saved Shapes">
            <option v-for="save in dbSaves" :key="save.id" :value="`db:${save.id}`">
              {{ save.name }}
            </option>
          </optgroup>
        </select>
      </div>

      <div class="control-group grow">
        <label for="save-name">Name</label>
        <input
          id="save-name"
          v-model="saveName"
          type="text"
          class="control-input"
          placeholder="Name your scale shape"
        />
      </div>

      <div class="control-group buttons">
        <button class="btn-primary btn-small" :disabled="!saveName.trim()" @click="saveShape">
          Save
        </button>
        <button
          class="btn-secondary btn-small"
          :disabled="!isSavedShapeSelected || !saveName.trim()"
          @click="renameSelected"
        >
          Rename
        </button>
        <button class="btn-danger btn-small" :disabled="!isSavedShapeSelected" @click="deleteSelected">
          Delete
        </button>
        <button class="btn-secondary btn-small" @click="clearNotes">
          Clear
        </button>
        <button class="btn-secondary btn-small" @click="printFretboard">
          Print
        </button>
      </div>
    </div>

    <p v-if="statusMessage" class="status-message no-print">{{ statusMessage }}</p>

    <!-- Fretboard -->
    <div class="fretboard-scroll">
      <div class="fretboard-scale" :style="gridStyle">
        <!-- Header row -->
        <div class="corner-cell"></div>
        <div
          v-for="fret in fretNumbers"
          :key="`head-${fret}`"
          class="fret-head"
          :class="{ 'fret-head-inlay': inlayFrets.includes(fret), 'fret-head-blocked': isBlocked(fret), 'fret-head-capo': fret === capo }"
        >
          {{ fret }}
        </div>

        <!-- String rows -->
        <template v-for="string in 6" :key="`row-${string}`">
          <!-- Open string (nut) label, doubles as a togglable "fret 0" -->
          <div
            class="string-head"
            :class="{ 'string-head-blocked': isBlocked(0) }"
            @click="handleLeftClick(string, 0)"
            @contextmenu.prevent="handleRightClick(string, 0)"
          >
            <div v-if="isMarked(string, 0) && !isBlocked(0)" class="note-marker header-marker">
              {{ getNoteLabel(string, 0) }}
            </div>
            <span v-else>{{ getNoteLabel(string, 0) }}</span>
          </div>
          <div
            v-for="fret in fretNumbers"
            :key="`cell-${string}-${fret}`"
            class="fret-cell"
            :class="{
              'fret-cell-nut': fret === 1,
              'fret-cell-inlay': inlayFrets.includes(fret),
              'fret-cell-blocked': isBlocked(fret),
              'fret-cell-capo': fret === capo
            }"
            @click="handleLeftClick(string, fret)"
            @contextmenu.prevent="handleRightClick(string, fret)"
          >
            <div class="fret-wire"></div>
            <div class="string-wire"></div>
            <div
              v-if="isMarked(string, fret) || isCapoNote(fret)"
              class="note-marker"
              :class="{ 'note-marker-capo': isCapoNote(fret) }"
            >
              {{ getNoteLabel(string, fret) }}
            </div>
          </div>
        </template>
      </div>
    </div>

    <div class="legend no-print">
      <span>{{ markedCount }} note{{ markedCount === 1 ? '' : 's' }} marked</span>
      <span v-if="capo > 0" class="capo-note">Capo at fret {{ capo }} &mdash; frets before it are muted and can't be played.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getNoteLabel as computeNoteLabel } from '../utils/noteNames'
import { cagedCMajorPresets, type ScalePreset, type ScalePosition } from '../data/scaleEditorPresets'
import { saveScale, getAllSavedScales, deleteScale, renameScale, type SavedScale } from '../db/practiceDb'
import { useGuitarSampler } from '../composables/useGuitarSampler'

const FRET_COUNT = 15 // frets 1 through 15; the open string is its own header cell
const inlayFrets = [3, 5, 7, 9, 12, 15]

const presets: ScalePreset[] = cagedCMajorPresets

const guitarSampler = useGuitarSampler()

const fretNumbers = computed(() => Array.from({ length: FRET_COUNT }, (_, i) => i + 1))

const gridStyle = computed(() => ({
  gridTemplateColumns: `56px repeat(${FRET_COUNT}, 48px)`
}))

// Marked notes, keyed as "string-fret" (fret 0 = open string)
const markedPositions = ref<Set<string>>(new Set())
const capo = ref(0)

// A capo mutes the true open string and everything behind it, so those
// positions can't be played: fret 0 is blocked whenever a capo is on, and
// frets 1..(capo-1) are blocked because the capo is already fretting there.
const isBlocked = (fret: number): boolean => {
  if (capo.value <= 0) return false
  if (fret === 0) return true
  return fret < capo.value
}

// The fret the capo sits on acts as the new "open" position for every
// string, so it's always considered part of the shape: shown automatically
// and never removable, same as the open string is when there's no capo.
const isCapoNote = (fret: number): boolean => {
  return capo.value > 0 && fret === capo.value
}

const markedCount = computed(() => markedPositions.value.size)

const keyFor = (string: number, fret: number) => `${string}-${fret}`

const isMarked = (string: number, fret: number): boolean => {
  return markedPositions.value.has(keyFor(string, fret))
}

const markNote = (string: number, fret: number) => {
  const key = keyFor(string, fret)
  if (markedPositions.value.has(key)) return
  const next = new Set(markedPositions.value)
  next.add(key)
  markedPositions.value = next
}

const unmarkNote = (string: number, fret: number) => {
  const key = keyFor(string, fret)
  if (!markedPositions.value.has(key)) return
  const next = new Set(markedPositions.value)
  next.delete(key)
  markedPositions.value = next
}

// A fretted note's pitch only depends on the actual fret pressed, never the
// capo (the capo just makes frets below it unreachable, handled by isBlocked).
const getNoteLabel = (string: number, fret: number): string => {
  return computeNoteLabel(string, fret)
}

const ensureAudioReady = async (): Promise<void> => {
  await guitarSampler.startAudio()
  if (!guitarSampler.isLoaded.value) {
    await guitarSampler.initializeSampler()
  }
}

const handleLeftClick = async (string: number, fret: number) => {
  if (isBlocked(fret)) return
  // The capo's own fret is auto-marked already; don't also add it as a
  // regular (removable) mark.
  if (!isCapoNote(fret)) {
    markNote(string, fret)
  }
  try {
    await ensureAudioReady()
    guitarSampler.playString(string, fret)
  } catch (error) {
    console.error('Failed to play note:', error)
  }
}

const handleRightClick = (string: number, fret: number) => {
  // The capo's fret can't be removed - it's always the effective open note.
  if (isCapoNote(fret)) return
  // Otherwise always allow removing a mark, even one left behind in a
  // now-blocked region (e.g. after raising the capo), so it's never stuck.
  unmarkNote(string, fret)
}

const clearNotes = () => {
  markedPositions.value = new Set()
  selectedLoadKey.value = ''
  statusMessage.value = ''
}

const positionsToArray = (): ScalePosition[] => {
  return Array.from(markedPositions.value).map(key => {
    const [stringStr, fretStr] = key.split('-')
    return { string: Number(stringStr), fret: Number(fretStr) }
  })
}

const loadPositions = (positions: ScalePosition[], capoValue: number) => {
  const next = new Set<string>()
  positions.forEach(p => next.add(keyFor(p.string, p.fret)))
  markedPositions.value = next
  capo.value = capoValue
}

// Saved shapes live in IndexedDB only, the same mechanism the rest of the
// app uses for named user saves (see savedProgressions in practiceDb.ts).
const dbSaves = ref<SavedScale[]>([])

const refreshDbSaves = async () => {
  dbSaves.value = await getAllSavedScales()
}

onMounted(() => {
  refreshDbSaves()
})

// --- Save / Load UI state ---
const saveName = ref('')
const selectedLoadKey = ref('')
const statusMessage = ref('')

const isSavedShapeSelected = computed(() => selectedLoadKey.value.startsWith('db:'))

const saveShape = async () => {
  const name = saveName.value.trim()
  if (!name) return
  const id = await saveScale(name, capo.value, positionsToArray())
  await refreshDbSaves()
  selectedLoadKey.value = `db:${id}`
  statusMessage.value = `Saved "${name}".`
}

const handleLoadChange = () => {
  const key = selectedLoadKey.value
  statusMessage.value = ''
  if (!key) return

  if (key.startsWith('preset:')) {
    const id = key.slice('preset:'.length)
    const preset = presets.find(p => p.id === id)
    if (preset) {
      loadPositions(preset.positions, preset.capo)
      saveName.value = preset.name
    }
  } else if (key.startsWith('db:')) {
    const id = Number(key.slice('db:'.length))
    const save = dbSaves.value.find(s => s.id === id)
    if (save) {
      loadPositions(save.positions, save.capo)
      saveName.value = save.name
    }
  }
}

const renameSelected = async () => {
  if (!isSavedShapeSelected.value) return
  const name = saveName.value.trim()
  if (!name) return
  const id = Number(selectedLoadKey.value.slice('db:'.length))
  await renameScale(id, name)
  await refreshDbSaves()
  statusMessage.value = `Renamed to "${name}".`
}

const deleteSelected = async () => {
  if (!isSavedShapeSelected.value) return
  const id = Number(selectedLoadKey.value.slice('db:'.length))
  const save = dbSaves.value.find(s => s.id === id)
  await deleteScale(id)
  await refreshDbSaves()
  statusMessage.value = save ? `Deleted "${save.name}".` : 'Deleted saved scale.'
  selectedLoadKey.value = ''
}

const printFretboard = () => {
  window.print()
}
</script>

<style scoped>
.scale-editor-container {
  max-width: 1200px;
  margin: 0 auto;
}

.header-section {
  margin-bottom: 1.5rem;
  text-align: center;
}

.header-section h2 {
  font-size: 1.5rem;
  font-weight: bold;
  color: #1f2937;
}

.subtitle {
  color: #6b7280;
  font-size: 0.9rem;
  margin-top: 0.25rem;
}

.loading-note {
  color: #ca8a04;
  font-size: 0.85rem;
  margin-top: 0.5rem;
  font-style: italic;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.control-group.grow {
  flex: 1;
  min-width: 180px;
}

.control-group.buttons {
  flex-direction: row;
  align-items: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.control-group label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #4b5563;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.control-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  background: white;
  color: #1f2937;
}

.btn-small {
  padding: 0.5rem 0.9rem;
  font-size: 0.8rem;
}

.btn-secondary {
  background-color: #e5e7eb;
  color: #1f2937;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #d1d5db;
}

.status-message {
  color: #16a34a;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
  text-align: center;
}

.fretboard-scroll {
  overflow-x: auto;
  border: 1px solid #000;
  border-radius: 4px;
  background: #fff;
}

.fretboard-scale {
  display: grid;
  grid-auto-rows: 48px;
  min-width: max-content;
}

.corner-cell {
  border-bottom: 2px solid #000;
}

.fret-head {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: #000;
  border-bottom: 2px solid #000;
  border-left: 1px solid #9ca3af;
}

.fret-head-inlay {
  background-color: #f3f4f6;
}

.fret-head-blocked {
  background-color: #d1d5db;
  color: #6b7280;
}

.fret-head-capo {
  position: relative;
}

.fret-head-capo::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 3px;
  background-color: #dc2626;
  transform: translateX(-50%);
}

.string-head {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: #000;
  border-right: 2px solid #000;
  background-color: #f9fafb;
  cursor: pointer;
}

.string-head:hover {
  background-color: #e5e7eb;
}

.string-head-blocked {
  cursor: not-allowed;
  color: #9ca3af;
  background-color: #e5e7eb;
}

.string-head-blocked:hover {
  background-color: #e5e7eb;
}

.fret-cell {
  position: relative;
  border-left: 1px solid #9ca3af;
  cursor: pointer;
  background-color: #fff;
}

.fret-cell-inlay {
  background-color: #f3f4f6;
}

.fret-cell-nut {
  border-left: 3px solid #000;
}

.fret-cell-capo::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 3px;
  background-color: #dc2626;
  transform: translateX(-50%);
  z-index: 1;
}

.fret-cell-blocked {
  background-color: #d1d5db;
  cursor: not-allowed;
}

.fret-cell-blocked:hover {
  background-color: #d1d5db;
}

.fret-cell:hover {
  background-color: #e5e7eb;
}

.fret-wire {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: #4b5563;
}

.string-wire {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  background-color: #9ca3af;
  transform: translateY(-50%);
}

.note-marker {
  position: absolute;
  inset: 4px;
  border-radius: 50%;
  border: 2px solid #000;
  background-color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 700;
  color: #000;
  z-index: 2;
}

.header-marker {
  inset: auto;
  top: 50%;
  left: 50%;
  width: 38px;
  height: 38px;
  transform: translate(-50%, -50%);
}

.note-marker-capo {
  border-color: #dc2626;
}

.legend {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  font-size: 0.85rem;
  color: #4b5563;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.capo-note {
  font-style: italic;
}

/* Printing: keep everything black & white and drop the editing controls */
@media print {
  .no-print {
    display: none !important;
  }

  .scale-editor-container {
    box-shadow: none;
    padding: 0;
  }

  .fretboard-scroll {
    overflow: visible;
  }

  .fret-head,
  .string-head,
  .fret-cell,
  .fret-cell-inlay,
  .fret-head-inlay,
  .fret-cell-blocked,
  .fret-head-blocked,
  .string-head-blocked {
    background-color: #fff !important;
    color: #000 !important;
  }

  .fret-cell-capo::before,
  .fret-head-capo::after {
    background-color: #000 !important;
  }

  .note-marker-capo {
    border-color: #000 !important;
  }
}
</style>
