import { ref, computed, onUnmounted } from 'vue'

export interface MetronomeConfig {
  bpm: number;
  beatsPerBar: number;
  subdivision: number; // 1 = quarter notes, 2 = eighth notes, 4 = sixteenth notes
}

export function useMetronome(config: MetronomeConfig) {
  const bpm = ref(config.bpm)
  const beatsPerBar = ref(config.beatsPerBar)
  const subdivision = ref(config.subdivision)

  const isPlaying = ref(false)
  const currentBeat = ref(0)
  const currentBar = ref(0)
  const currentSubdivision = ref(0)

  // Time tracking
  const startTime = ref<number | null>(null)
  const elapsedTime = ref(0)

  // Audio context for metronome click
  const audioContext = ref<AudioContext | null>(null)
  const clickEnabled = ref(true)

  // Timing
  let intervalId: number | null = null
  let animationFrameId: number | null = null

  // Calculate timing values
  const beatDuration = computed(() => 60000 / bpm.value) // milliseconds per beat
  const subdivisionDuration = computed(() => beatDuration.value / subdivision.value)

  // Initialize audio context
  function initAudio() {
    if (!audioContext.value) {
      audioContext.value = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
  }

  // Play click sound
  function playClick(isAccent = false) {
    if (!clickEnabled.value || !audioContext.value) return

    const ctx = audioContext.value
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    // Accent (downbeat) is higher pitch and louder
    oscillator.frequency.value = isAccent ? 880 : 440
    gainNode.gain.value = isAccent ? 0.3 : 0.15

    const now = ctx.currentTime
    oscillator.start(now)

    // Quick fade out for a sharp click
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05)
    oscillator.stop(now + 0.05)
  }

  // Update loop using requestAnimationFrame for smooth updates
  function updateLoop() {
    if (!isPlaying.value || startTime.value === null) return

    const now = performance.now()
    elapsedTime.value = now - startTime.value

    animationFrameId = requestAnimationFrame(updateLoop)
  }

  // Start metronome
  function start() {
    if (isPlaying.value) return

    initAudio()
    isPlaying.value = true
    startTime.value = performance.now()
    elapsedTime.value = 0
    currentBeat.value = 0
    currentBar.value = 0
    currentSubdivision.value = 0

    // Play first click immediately
    playClick(true)

    // Set up interval for subsequent clicks
    intervalId = window.setInterval(() => {
      currentSubdivision.value++

      if (currentSubdivision.value >= subdivision.value) {
        currentSubdivision.value = 0
        currentBeat.value++

        if (currentBeat.value >= beatsPerBar.value) {
          currentBeat.value = 0
          currentBar.value++
        }
      }

      // Play click on each subdivision
      const isDownbeat = currentBeat.value === 0 && currentSubdivision.value === 0
      playClick(isDownbeat)

    }, subdivisionDuration.value)

    // Start animation loop for smooth elapsed time
    updateLoop()
  }

  // Stop metronome
  function stop() {
    isPlaying.value = false
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }

  // Reset metronome
  function reset() {
    stop()
    currentBeat.value = 0
    currentBar.value = 0
    currentSubdivision.value = 0
    elapsedTime.value = 0
    startTime.value = null
  }

  // Get current time position in milliseconds
  function getCurrentTime() {
    return elapsedTime.value
  }

  // Calculate when a specific strum instruction should occur
  function getStrumTime(beat: number, subdivisionOffset: number) {
    const totalBeats = beat + subdivisionOffset
    return totalBeats * beatDuration.value
  }

  // Check if current time is within window of expected time
  function isInWindow(expectedTime: number, toleranceMs = 150): boolean {
    const currentTime = getCurrentTime()
    return Math.abs(currentTime - expectedTime) <= toleranceMs
  }

  // Get current position as beat + subdivision
  function getCurrentPosition(): { bar: number; beat: number; subdivision: number } {
    return {
      bar: currentBar.value,
      beat: currentBeat.value,
      subdivision: currentSubdivision.value
    }
  }

  // Update BPM (can be adjusted while playing)
  function setBPM(newBpm: number) {
    const wasPlaying = isPlaying.value
    if (wasPlaying) {
      stop()
    }
    bpm.value = Math.max(40, Math.min(240, newBpm)) // Clamp between 40-240
    if (wasPlaying) {
      start()
    }
  }

  // Toggle click sound
  function toggleClick() {
    clickEnabled.value = !clickEnabled.value
  }

  // Cleanup on unmount
  onUnmounted(() => {
    stop()
    if (audioContext.value) {
      audioContext.value.close()
    }
  })

  return {
    // State
    bpm,
    beatsPerBar,
    subdivision,
    isPlaying,
    currentBeat,
    currentBar,
    currentSubdivision,
    elapsedTime,
    clickEnabled,

    // Computed
    beatDuration,
    subdivisionDuration,

    // Methods
    start,
    stop,
    reset,
    setBPM,
    toggleClick,
    getCurrentTime,
    getStrumTime,
    isInWindow,
    getCurrentPosition
  }
}
