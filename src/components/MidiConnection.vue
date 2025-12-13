<template>
  <div class="midi-connection">
    <header class="header">
      <h1>Web MIDI Receiver</h1>
      <p class="status">{{ statusMessage }}</p>
      <p class="note">
        NOTE: This application requires a Chromium-based browser (Chrome, Edge, Opera) and **must be run over HTTPS or localhost** for Web MIDI functionality.
      </p>
    </header>

    <div class="button-group">
      <button
        @click="handleConnect"
        class="btn-primary"
        :disabled="!isSupported"
      >
        {{ isConnected ? 'Refresh Device List' : 'Connect MIDI Device (Tap or Click)' }}
      </button>
      <button
        @click="disconnect"
        class="btn-danger"
        :disabled="!isConnected"
      >
        Disconnect All
      </button>
    </div>

    <div class="section">
      <h2>Connected Devices</h2>
      <div class="device-list">
        <p v-if="connectedInputs.length === 0" class="empty-message">
          No devices connected yet.
        </p>
        <div
          v-for="input in connectedInputs"
          :key="input.id"
          class="device-item"
        >
          <p class="device-name">{{ input.name }}</p>
          <p class="device-info">Manufacturer: {{ input.manufacturer || 'N/A' }} | Type: Input</p>
          <p class="device-info">State: <span class="device-state">{{ input.state }}</span></p>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>MIDI Message Log</h2>
        <button
          @click="handleClearMessages"
          class="btn-secondary"
        >
          Clear Logs
        </button>
      </div>
      <div ref="logContainer" class="log scrollable">
        <p
          v-for="(message, index) in messages"
          :key="index"
          :class="getMessageColorClass(message.color)"
        >
          [{{ message.timestamp }}] [{{ message.portName }}] {{ message.messageType }}: {{ message.detail }}
        </p>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h2>Data Backup & Restore</h2>
      </div>
      <p class="backup-description">
        Export all your practice data (chord practice, plucking practice, and saved progressions) to a JSON file for backup.
        Import will merge with existing data without overwriting.
      </p>
      <div class="button-group">
        <button @click="exportData" class="btn-export">
          📥 Export All Data
        </button>
        <label for="import-file" class="btn-import">
          📤 Import & Merge Data
          <input
            id="import-file"
            type="file"
            accept="application/json"
            @change="importData"
            style="display: none"
          />
        </label>
      </div>
      <p v-if="exportMessage" class="export-message" :class="exportMessageType">
        {{ exportMessage }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from 'vue'
import { sharedMidi } from '../composables/useMidi'
import {
  getAllProgress,
  getAllPluckingProgress,
  getAllSavedProgressions,
  saveProgression,
  db,
  type DailyProgress,
  type DailyPluckingProgress,
  type SavedProgression
} from '../db/practiceDb'

const {
  connectedInputs,
  messages,
  statusMessage,
  isSupported,
  isConnected,
  connect,
  disconnect,
  clearMessages,
  checkSupport
} = sharedMidi

const logContainer = ref<HTMLDivElement | null>(null)
const exportMessage = ref('')
const exportMessageType = ref<'success' | 'error'>('success')

const handleConnect = async () => {
  await connect()
}

const handleClearMessages = () => {
  clearMessages()
}

const getMessageColorClass = (color: string): string => {
  const colorMap: Record<string, string> = {
    'text-green-600': 'text-green',
    'text-green-700': 'text-green',
    'text-orange-500': 'text-orange',
    'text-blue-600': 'text-blue',
    'text-blue-500': 'text-blue',
    'text-purple-600': 'text-purple',
    'text-purple-700': 'text-purple',
    'text-yellow-600': 'text-yellow',
    'text-red-700': 'text-red',
    'text-gray-800': 'text-gray'
  }
  return colorMap[color] || 'text-gray'
}

// Export data to JSON file
const exportData = async () => {
  try {
    const [chordData, pluckingData, savedProgressions] = await Promise.all([
      getAllProgress(),
      getAllPluckingProgress(),
      getAllSavedProgressions()
    ])

    // Combine all data types
    const exportedData = {
      chordPractice: chordData,
      pluckingPractice: pluckingData,
      savedProgressions: savedProgressions,
      version: 2 // Updated version to include saved progressions
    }

    // Create filename with timestamp
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `fingerbuster-backup-${timestamp}.json`

    // Create JSON blob
    const jsonStr = JSON.stringify(exportedData, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })

    // Create download link and trigger download
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    exportMessage.value = `✅ Data exported successfully to ${filename}`
    exportMessageType.value = 'success'
    setTimeout(() => { exportMessage.value = '' }, 5000)

    console.log('Data exported successfully')
  } catch (err) {
    exportMessage.value = `❌ Failed to export data: ${(err as Error).message}`
    exportMessageType.value = 'error'
    setTimeout(() => { exportMessage.value = '' }, 5000)
    console.error('Error exporting data:', err)
  }
}

// Import data from JSON file with merge logic
const importData = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) return

  try {
    const text = await file.text()
    const parsed = JSON.parse(text)

    let chordDataToImport: DailyProgress[] = []
    let pluckingDataToImport: DailyPluckingProgress[] = []
    let progressionsToImport: SavedProgression[] = []

    // Check format and extract data
    if (Array.isArray(parsed)) {
      // Old format: only chord practice data
      chordDataToImport = parsed
    } else if (parsed.chordPractice || parsed.pluckingPractice || parsed.savedProgressions) {
      // New format: object with all types
      chordDataToImport = parsed.chordPractice || []
      pluckingDataToImport = parsed.pluckingPractice || []
      progressionsToImport = parsed.savedProgressions || []
    } else {
      throw new Error('Invalid data format')
    }

    let importedCount = 0

    // Import chord practice data
    if (chordDataToImport.length > 0) {
      const existingChordData = await getAllProgress()
      const existingChordMap = new Map(existingChordData.map(d => [d.dateId, d]))

      for (const importedDay of chordDataToImport) {
        if (!importedDay.dateId || !importedDay.transitions) {
          console.warn('Skipping invalid chord entry:', importedDay)
          continue
        }

        const existing = existingChordMap.get(importedDay.dateId)

        if (existing) {
          // Merge: combine transitions
          const combinedTransitions = [...existing.transitions, ...importedDay.transitions]
          await db.dailyProgress.put({
            dateId: importedDay.dateId,
            transitions: combinedTransitions
          })
          console.log(`Merged chord data for ${importedDay.dateId}`)
        } else {
          // New date: add it
          await db.dailyProgress.add({
            dateId: importedDay.dateId,
            transitions: importedDay.transitions
          })
          console.log(`Added new chord data for ${importedDay.dateId}`)
        }
        importedCount++
      }
    }

    // Import plucking practice data
    if (pluckingDataToImport.length > 0) {
      const existingPluckingData = await getAllPluckingProgress()
      const existingPluckingMap = new Map(existingPluckingData.map(d => [d.dateId, d]))

      for (const importedDay of pluckingDataToImport) {
        if (!importedDay.dateId || !importedDay.plucks) {
          console.warn('Skipping invalid plucking entry:', importedDay)
          continue
        }

        const existing = existingPluckingMap.get(importedDay.dateId)

        if (existing) {
          // Merge: combine plucks
          const combinedPlucks = [...existing.plucks, ...importedDay.plucks]
          await db.dailyPluckingProgress.put({
            dateId: importedDay.dateId,
            plucks: combinedPlucks
          })
          console.log(`Merged plucking data for ${importedDay.dateId}`)
        } else {
          // New date: add it
          await db.dailyPluckingProgress.add({
            dateId: importedDay.dateId,
            plucks: importedDay.plucks
          })
          console.log(`Added new plucking data for ${importedDay.dateId}`)
        }
        importedCount++
      }
    }

    // Import saved progressions
    if (progressionsToImport.length > 0) {
      const existingProgressions = await getAllSavedProgressions()
      const existingProgressionNames = new Set(existingProgressions.map(p => p.name))

      for (const progression of progressionsToImport) {
        if (!progression.name || !progression.chords) {
          console.warn('Skipping invalid progression entry:', progression)
          continue
        }

        if (existingProgressionNames.has(progression.name)) {
          // Progression with same name exists - skip to avoid overwriting
          console.log(`Skipping progression "${progression.name}" (already exists)`)
        } else {
          // New progression: add it (using saveProgression which handles duplicates)
          await saveProgression(progression.name, progression.chords)
          console.log(`Added new progression: ${progression.name}`)
          importedCount++
        }
      }
    }

    exportMessage.value = `✅ Import successful! Merged ${importedCount} items.`
    exportMessageType.value = 'success'
    setTimeout(() => { exportMessage.value = '' }, 5000)

    // Reset file input
    input.value = ''
  } catch (err) {
    exportMessage.value = `❌ Failed to import data: ${(err as Error).message}`
    exportMessageType.value = 'error'
    setTimeout(() => { exportMessage.value = '' }, 5000)
    console.error('Error importing data:', err)
    // Reset file input
    input.value = ''
  }
}

// Auto-scroll to bottom when new messages arrive
watch(messages, async () => {
  await nextTick()
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight
  }
}, { deep: true })

onMounted(() => {
  checkSupport()
})
</script>

<style scoped>
.midi-connection {
  max-width: 900px;
  margin: 0 auto;
  background: white;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  padding: 2rem;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 1.875rem;
  font-weight: 800;
  color: #4f46e5;
  margin-bottom: 0.5rem;
}

.status {
  font-size: 1.125rem;
  font-weight: 500;
  color: #4b5563;
  margin-bottom: 0.5rem;
}

.note {
  font-size: 0.875rem;
  font-weight: 600;
  color: #dc2626;
}

.button-group {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.button-group button {
  flex: 1;
}

.section {
  margin-bottom: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
  margin-bottom: 1rem;
}

.section h2 {
  font-size: 1.25rem;
  font-weight: bold;
  color: #1f2937;
  margin: 0;
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.empty-message {
  color: #9ca3af;
  font-style: italic;
}

.device-item {
  padding: 0.75rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.device-name {
  font-weight: 600;
  color: #111827;
  margin-bottom: 0.25rem;
}

.device-info {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.device-state {
  color: #16a34a;
}

.log {
  background-color: #f3f4f6;
  padding: 1rem;
  border-radius: 8px;
  height: 16rem;
  font-size: 0.875rem;
  font-family: 'Courier New', monospace;
  color: #1f2937;
}

.log p {
  margin-bottom: 0.25rem;
}

.backup-description {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.btn-export,
.btn-import {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-export {
  background: #10b981;
  color: white;
  flex: 1;
}

.btn-export:hover {
  background: #059669;
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(16, 185, 129, 0.3);
}

.btn-import {
  background: #3b82f6;
  color: white;
  flex: 1;
}

.btn-import:hover {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
}

.export-message {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
}

.export-message.success {
  background-color: #d1fae5;
  color: #065f46;
  border: 1px solid #10b981;
}

.export-message.error {
  background-color: #fee2e2;
  color: #991b1b;
  border: 1px solid #ef4444;
}

@media (max-width: 640px) {
  .button-group {
    flex-direction: column;
  }
}
</style>
