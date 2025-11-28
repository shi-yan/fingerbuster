<template>
  <div class="chord-practice">
    <!-- Connection status card -->
    <div class="status-card card">
      <div class="status-header">
        <div>
          <h2>MIDI Connection Status</h2>
          <p class="status-message">{{ statusMessage }}</p>
        </div>
        <div class="button-container">
          <button
            v-if="!isConnected"
            @click="connect"
            class="btn-primary"
            :disabled="!isSupported"
          >
            Connect MIDI
          </button>
          <button
            v-else
            @click="disconnect"
            class="btn-danger"
          >
            Disconnect
          </button>
        </div>
      </div>

      <!-- Connected devices summary -->
      <div v-if="connectedInputs.length > 0" class="devices-summary">
        <p class="text-green">
          Connected to {{ connectedInputs.length }} device(s):
          {{ connectedInputs.map(i => i.name).join(', ') }}
        </p>
      </div>
    </div>

    <!-- FretBoard component -->
    <FretBoard :fretPositions="fretPositions" />

    <!-- Recent MIDI messages -->
    <div class="messages-card card">
      <h3>Recent MIDI Messages</h3>
      <div class="messages-log scrollable">
        <p
          v-for="(message, index) in recentMessages"
          :key="index"
          :class="getMessageColorClass(message.color)"
        >
          [{{ message.timestamp }}] {{ message.messageType }}: {{ message.detail }}
        </p>
        <p v-if="messages.length === 0" class="empty-message">
          No messages yet. Press some strings on your MIDI guitar!
        </p>
      </div>
    </div>

    <!-- Instructions -->
    <div class="instructions">
      <h4>How to use:</h4>
      <ul>
        <li>Connect your MIDI guitar using the "Connect MIDI" button above</li>
        <li>Press frets on your guitar strings</li>
        <li>The fretboard will show which strings and frets you're pressing</li>
        <li>Channel number corresponds to string number (Channel 6 = 6th string, Channel 1 = 1st string)</li>
        <li>The MIDI value corresponds to the fret number being pressed</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useMidi } from '../composables/useMidi'
import FretBoard from './FretBoard.vue'

const {
  connectedInputs,
  messages,
  fretPositions,
  statusMessage,
  isSupported,
  isConnected,
  connect,
  disconnect,
  checkSupport
} = useMidi()

const recentMessages = computed(() => {
  return messages.value.slice(-20).reverse()
})

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

onMounted(() => {
  checkSupport()
})
</script>

<style scoped>
.chord-practice {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.status-card {
  background: white;
}

.status-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.status-header h2 {
  font-size: 1.25rem;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 0.25rem;
}

.status-message {
  font-size: 0.875rem;
  color: #6b7280;
}

.button-container {
  display: flex;
  gap: 0.75rem;
}

.devices-summary {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.devices-summary p {
  font-size: 0.875rem;
  font-weight: 600;
}

.messages-card h3 {
  font-size: 1.125rem;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 0.75rem;
}

.messages-log {
  background-color: #f3f4f6;
  padding: 1rem;
  border-radius: 8px;
  height: 12rem;
  font-size: 0.875rem;
  font-family: 'Courier New', monospace;
}

.messages-log p {
  margin-bottom: 0.25rem;
}

.empty-message {
  color: #9ca3af;
  font-style: italic;
}

.instructions {
  background: #eff6ff;
  border-left: 4px solid #3b82f6;
  padding: 1rem;
  border-radius: 4px;
}

.instructions h4 {
  font-weight: bold;
  color: #1e40af;
  margin-bottom: 0.5rem;
}

.instructions ul {
  list-style-type: disc;
  padding-left: 1.5rem;
  font-size: 0.875rem;
  color: #1d4ed8;
}

.instructions li {
  margin-bottom: 0.25rem;
}
</style>
