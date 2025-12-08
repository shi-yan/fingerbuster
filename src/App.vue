<template>
  <div class="app-container">
    <!-- Left sidebar menu -->
    <div class="sidebar">
      <div class="sidebar-header">
        <h1>Guitar Learning</h1>
        <p>MIDI Guitar App</p>
      </div>

      <nav class="menu">
        <button
          v-for="item in menuItems"
          :key="item.id"
          @click="currentView = item.id"
          class="menu-item"
          :class="{ active: currentView === item.id }"
        >
          <span class="menu-icon">{{ item.icon }}</span>
          <div class="menu-content">
            <div class="menu-label">{{ item.label }}</div>
            <div class="menu-description">{{ item.description }}</div>
          </div>
        </button>
      </nav>

      <div class="sidebar-footer">
        <p>Requires HTTPS or localhost</p>
      </div>
    </div>

    <!-- Right content area -->
    <div class="main-content">
      <div class="content-wrapper">
        <MidiConnection v-if="currentView === 'connection'" />
        <ChordPractice v-else-if="currentView === 'chord-practice'" />
        <PracticeMode v-else-if="currentView === 'practice-mode'" />
        <PluckingPractice v-else-if="currentView === 'plucking-practice'" />
        <ProgressChart v-else-if="currentView === 'progress-chart'" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import MidiConnection from './components/MidiConnection.vue'
import ChordPractice from './components/ChordPractice.vue'
import PracticeMode from './components/PracticeMode.vue'
import PluckingPractice from './components/PluckingPractice.vue'
import ProgressChart from './components/ProgressChart.vue'

type ViewId = 'connection' | 'chord-practice' | 'practice-mode' | 'plucking-practice' | 'progress-chart'

interface MenuItem {
  id: ViewId
  label: string
  description: string
  icon: string
}

const menuItems: MenuItem[] = [
  {
    id: 'connection',
    label: 'Connection',
    description: 'MIDI device setup',
    icon: '🔌'
  },
  {
    id: 'chord-practice',
    label: 'Chord Practice',
    description: 'Fretboard visualization',
    icon: '🎸'
  },
  {
    id: 'practice-mode',
    label: 'Practice Mode',
    description: 'Timed chord practice',
    icon: '🎯'
  },
  {
    id: 'plucking-practice',
    label: 'Plucking Practice',
    description: 'Right-hand accuracy',
    icon: '🎵'
  },
  {
    id: 'progress-chart',
    label: 'Progress Chart',
    description: 'View your improvements',
    icon: '📊'
  }
]

const currentView = ref<ViewId>('connection')
</script>

<style scoped>
.app-container {
  display: flex;
  height: 100vh;
  background-color: #f3f4f6;
}

.sidebar {
  width: 256px;
  background-color: #312e81;
  color: white;
  flex-shrink: 0;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-header h1 {
  font-size: 1.5rem;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.sidebar-header p {
  font-size: 0.875rem;
  color: #c7d2fe;
}

.menu {
  margin-top: 1.5rem;
  flex: 1;
}

.menu-item {
  width: 100%;
  text-align: left;
  padding: 1rem 1.5rem;
  background: none;
  color: white;
  border: none;
  border-left: 4px solid transparent;
  transition: all 0.15s ease-in-out;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.menu-item:hover {
  background-color: #3730a3;
}

.menu-item.active {
  background-color: #3730a3;
  border-left-color: #818cf8;
}

.menu-icon {
  font-size: 1.5rem;
}

.menu-content {
  flex: 1;
}

.menu-label {
  font-weight: 600;
  font-size: 0.9375rem;
}

.menu-description {
  font-size: 0.75rem;
  color: #c7d2fe;
  margin-top: 0.25rem;
}

.sidebar-footer {
  padding: 1.5rem;
  background-color: #1e1b4b;
  text-align: center;
}

.sidebar-footer p {
  font-size: 0.75rem;
  color: #c7d2fe;
}

.main-content {
  flex: 1;
  overflow-y: auto;
}

.content-wrapper {
  padding: 2rem;
}
</style>
