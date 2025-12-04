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
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from 'vue'
import { sharedMidi } from '../midi'

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

@media (max-width: 640px) {
  .button-group {
    flex-direction: column;
  }
}
</style>
