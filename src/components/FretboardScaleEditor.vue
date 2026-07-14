<template>
  <div class="scale-editor-container card">
    <div class="header-section no-print">
      <h2>Fretboard Scale Editor</h2>
      <p class="subtitle">Click a fret to mark a note. Build your own scale shapes or start from a CAGED preset.</p>
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
          <optgroup v-if="localSaveNames.length > 0" label="Local Storage">
            <option v-for="name in localSaveNames" :key="name" :value="`local:${name}`">
              {{ name }}
            </option>
          </optgroup>
          <optgroup v-if="dbSaves.length > 0" label="IndexedDB">
            <option v-for="save in dbSaves" :key="save.id" :value="`db:${save.id}`">
              {{ save.name }}
            </option>
          </optgroup>
        </select>
        <button
          v-if="canDeleteSelected"
          class="btn-danger btn-small"
          @click="deleteSelected"
          title="Delete this save"
        >
          Delete
        </button>
      </div>

      <div class="control-group grow">
        <label for="save-name">Save As</label>
        <input
          id="save-name"
          v-model="saveName"
          type="text"
          class="control-input"
          placeholder="Name your scale shape"
        />
      </div>

      <div class="control-group buttons">
        <button class="btn-primary btn-small" :disabled="!saveName.trim()" @click="saveToLocalStorage">
          Save to Browser
        </button>
        <button class="btn-primary btn-small" :disabled="!saveName.trim()" @click="saveToIndexedDb">
          Save to Database
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
          :class="{ 'fret-head-inlay': inlayFrets.includes(fret) }"
        >
          {{ fret }}
        </div>

        <!-- String rows -->
        <template v-for="string in 6" :key="`row-${string}`">
          <div class="string-head">{{ stringNames[string - 1] }}</div>
          <div
            v-for="fret in fretNumbers"
            :key="`cell-${string}-${fret}`"
            class="fret-cell"
            :class="{ 'fret-cell-nut': fret === 0, 'fret-cell-inlay': inlayFrets.includes(fret) }"
            @click="toggleNote(string, fret)"
          >
            <div v-if="fret !== 0" class="fret-wire"></div>
            <div class="string-wire"></div>
            <div v-if="isMarked(string, fret)" class="note-marker">
              {{ getNoteLabel(string, fret, capo) }}
            </div>
          </div>
        </template>
      </div>
    </div>

    <div class="legend no-print">
      <span>{{ markedCount }} note{{ markedCount === 1 ? '' : 's' }} marked</span>
      <span v-if="capo > 0" class="capo-note">Capo at fret {{ capo }} &mdash; labels show the actual sounding pitch.</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getNoteLabel as computeNoteLabel } from '../utils/noteNames'
import { cagedCMajorPresets, type ScalePreset, type ScalePosition } from '../data/scaleEditorPresets'
import { saveScale, getAllSavedScales, deleteScale, type SavedScale } from '../db/practiceDb'

const LOCAL_STORAGE_KEY = 'fingerbuster-scale-saves'
const FRET_COUNT = 15 // frets 0 (open/capo) through 15
const inlayFrets = [3, 5, 7, 9, 12, 15]

interface LocalScaleSave {
  capo: number
  positions: ScalePosition[]
  updatedAt: number
}

// String names, index 0 = string 1 (high e)
const stringNames = ['e', 'B', 'G', 'D', 'A', 'E']

const presets: ScalePreset[] = cagedCMajorPresets

const fretNumbers = computed(() => Array.from({ length: FRET_COUNT + 1 }, (_, i) => i))

const gridStyle = computed(() => ({
  gridTemplateColumns: `56px repeat(${FRET_COUNT + 1}, 48px)`
}))

// Marked notes, keyed as "string-fret"
const markedPositions = ref<Set<string>>(new Set())
const capo = ref(0)

const markedCount = computed(() => markedPositions.value.size)

const keyFor = (string: number, fret: number) => `${string}-${fret}`

const isMarked = (string: number, fret: number): boolean => {
  return markedPositions.value.has(keyFor(string, fret))
}

const toggleNote = (string: number, fret: number) => {
  const next = new Set(markedPositions.value)
  const key = keyFor(string, fret)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  markedPositions.value = next
}

const getNoteLabel = (string: number, fret: number, capoValue: number): string => {
  return computeNoteLabel(string, fret, capoValue)
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

// --- Local storage saves ---
const getLocalSaves = (): Record<string, LocalScaleSave> => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (e) {
    console.error('Failed to parse local scale saves', e)
    return {}
  }
}

const setLocalSaves = (saves: Record<string, LocalScaleSave>) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(saves))
}

const localSaveNames = ref<string[]>(Object.keys(getLocalSaves()))

const refreshLocalSaveNames = () => {
  localSaveNames.value = Object.keys(getLocalSaves())
}

// --- IndexedDB saves ---
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

const canDeleteSelected = computed(() => {
  return selectedLoadKey.value.startsWith('local:') || selectedLoadKey.value.startsWith('db:')
})

const saveToLocalStorage = () => {
  const name = saveName.value.trim()
  if (!name) return
  const saves = getLocalSaves()
  saves[name] = {
    capo: capo.value,
    positions: positionsToArray(),
    updatedAt: Date.now()
  }
  setLocalSaves(saves)
  refreshLocalSaveNames()
  selectedLoadKey.value = `local:${name}`
  statusMessage.value = `Saved "${name}" to browser local storage.`
}

const saveToIndexedDb = async () => {
  const name = saveName.value.trim()
  if (!name) return
  const id = await saveScale(name, capo.value, positionsToArray())
  await refreshDbSaves()
  selectedLoadKey.value = `db:${id}`
  statusMessage.value = `Saved "${name}" to IndexedDB.`
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
  } else if (key.startsWith('local:')) {
    const name = key.slice('local:'.length)
    const saves = getLocalSaves()
    const save = saves[name]
    if (save) {
      loadPositions(save.positions, save.capo)
      saveName.value = name
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

const deleteSelected = async () => {
  const key = selectedLoadKey.value
  if (key.startsWith('local:')) {
    const name = key.slice('local:'.length)
    const saves = getLocalSaves()
    delete saves[name]
    setLocalSaves(saves)
    refreshLocalSaveNames()
    statusMessage.value = `Deleted "${name}" from browser local storage.`
  } else if (key.startsWith('db:')) {
    const id = Number(key.slice('db:'.length))
    const save = dbSaves.value.find(s => s.id === id)
    await deleteScale(id)
    await refreshDbSaves()
    statusMessage.value = save ? `Deleted "${save.name}" from IndexedDB.` : 'Deleted saved scale.'
  }
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

.string-head {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #000;
  border-right: 2px solid #000;
  background-color: #f9fafb;
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
  .fret-head-inlay {
    background-color: #fff !important;
    color: #000 !important;
  }
}
</style>
