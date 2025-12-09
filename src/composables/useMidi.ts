import { ref, onUnmounted } from 'vue'

export interface MidiMessage {
  timestamp: string
  portName: string
  messageType: string
  detail: string
  color: string
  channel?: number
  controller?: number
  value?: number
}

export interface FretPosition {
  string: number
  fret: number
}

export interface PluckedNote {
  string: number
  note: number
}

export function useMidi() {
  const midiAccess = ref<MIDIAccess | null>(null)
  const connectedInputs = ref<MIDIInput[]>([])
  const messages = ref<MidiMessage[]>([])
  const fretPositions = ref<Map<number, number>>(new Map())
  const stringsPlucked = ref<Set<number>>(new Set())
  const pluckOrder = ref<number[]>([]) // Track order of plucks
  const pluckedNotes = ref<Map<number, number>>(new Map()) // string -> note value
  const statusMessage = ref('Checking for Web MIDI support...')
  const isSupported = ref(false)
  const isConnected = ref(false)

  // Auto-clear timer for plucked strings
  let autoClearTimer: number | null = null
  const AUTO_CLEAR_DELAY = 1000 // 1 second

  const resetAutoClearTimer = () => {
    // Clear existing timer
    if (autoClearTimer !== null) {
      clearTimeout(autoClearTimer)
    }

    // Set new timer to auto-clear after delay
    autoClearTimer = window.setTimeout(() => {
      if (stringsPlucked.value.size > 0) {
        console.log('⏰ Auto-clearing plucked strings after 1 second of inactivity')
        // Create new empty Set to trigger reactivity
        stringsPlucked.value = new Set()
        pluckOrder.value = []
        pluckedNotes.value = new Map()
      }
    }, AUTO_CLEAR_DELAY)
  }

  const addMessage = (message: MidiMessage) => {
    messages.value.push(message)
    if (messages.value.length > 100) {
      messages.value.shift()
    }
  }

  const onMIDIMessage = (event: MIDIMessageEvent) => {
    if (!event.data || event.data.length < 1) return

    const status = event.data[0]
    if (status === undefined) return

    const data1 = event.data[1] ?? 0
    const data2 = event.data[2] ?? 0
    const portName = (event.target as MIDIInput).name || (event.target as MIDIInput).id || 'Unknown'

    const channel = (status & 0x0F) + 1
    const messageTypeByte = status & 0xF0

    let messageType = 'Unknown'
    let logColor = 'text-gray-800'
    let detail = ''

    switch (messageTypeByte) {
      case 0x90:
        if (data2 > 0) {
          messageType = 'Note ON'
          detail = `Channel ${channel} | Note: ${data1} (Velocity: ${data2})`
          logColor = 'text-green-600'
          // Track note-on events for guitar strings
          // NOTE: For Note ON, channels are inverted:
          // Channel 1 = 6th string, Channel 2 = 5th string, ..., Channel 6 = 1st string
          if (channel >= 1 && channel <= 6) {
            const guitarString = 7 - channel // Convert MIDI channel to guitar string (1-6)
            console.log(`🎵 Note ON - MIDI Channel ${channel} → Guitar String ${guitarString}, Note ${data1}`)

            // Add to set and trigger reactivity by creating new Set
            const newSet = new Set(stringsPlucked.value)
            newSet.add(guitarString)
            stringsPlucked.value = newSet

            pluckOrder.value.push(guitarString)
            pluckedNotes.value.set(guitarString, data1) // Store the note value
            console.log(`   Plucked strings: ${Array.from(stringsPlucked.value).join(', ')}`)
            console.log(`   Pluck order: ${pluckOrder.value.join(' → ')}`)

            // Reset auto-clear timer
            resetAutoClearTimer()
          }
        } else {
          messageType = 'Note OFF'
          detail = `Channel ${channel} | Note: ${data1}`
          logColor = 'text-orange-500'
        }
        break
      case 0x80:
        messageType = 'Note OFF'
        detail = `Channel ${channel} | Note: ${data1}`
        logColor = 'text-orange-500'
        break
      case 0xB0:
        messageType = 'CC (Control Change)'
        detail = `Channel ${channel} | Controller: ${data1}, Value: ${data2}`
        logColor = 'text-blue-600'

        // Update fret positions for guitar strings
        // Channel represents the string (1-6), data2 represents the fret
        // Controller 49 = finger press, Controller 50 = finger release
        if (channel >= 1 && channel <= 6) {
          if (data1 === 49) {
            // Finger press - set fret position
            if (data2 === 0) {
              fretPositions.value.delete(channel)
            } else {
              fretPositions.value.set(channel, data2)
            }
          } else if (data1 === 50) {
            // Finger release - remove fret position
            fretPositions.value.delete(channel)
          }
        }
        break
      case 0xC0:
        messageType = 'Program Change'
        detail = `Channel ${channel} | Program Number: ${data1}`
        logColor = 'text-purple-600'
        break
      case 0xE0:
        const pitchValue = ((data2 & 0x7F) << 7) | (data1 & 0x7F)
        messageType = 'Pitch Bend'
        detail = `Channel ${channel} | Value: ${pitchValue}`
        logColor = 'text-yellow-600'
        break
      case 0xF0:
        messageType = 'System Message'
        detail = `Status: 0x${status.toString(16)} (Bytes: ${event.data.length})`
        logColor = 'text-purple-700'
        break
      default:
        messageType = `MIDI Event 0x${status.toString(16)}`
        detail = `Data: 0x${data1 ? data1.toString(16) : 'N/A'}, 0x${data2 ? data2.toString(16) : 'N/A'}`
        break
    }

    addMessage({
      timestamp: new Date().toLocaleTimeString(),
      portName,
      messageType,
      detail,
      color: logColor,
      channel,
      controller: data1,
      value: data2
    })
  }

  const setupMIDIInputs = (midiAccessObj: MIDIAccess) => {
    connectedInputs.value = []

    if (midiAccessObj.inputs.size === 0) {
      return
    }

    midiAccessObj.inputs.forEach((input) => {
      input.onmidimessage = onMIDIMessage
      connectedInputs.value.push(input)
      addMessage({
        timestamp: new Date().toLocaleTimeString(),
        portName: input.name || 'Unknown',
        messageType: 'Connected',
        detail: `Listening to input port: ${input.name || 'Unknown'} (${input.manufacturer || 'N/A'})`,
        color: 'text-green-700'
      })
    })
  }

  const connect = async () => {
    if (typeof isSecureContext !== 'undefined' && !isSecureContext) {
      statusMessage.value = "Web MIDI API BLOCKED: Requires a Secure Context (HTTPS/localhost)."
      addMessage({
        timestamp: new Date().toLocaleTimeString(),
        portName: 'System',
        messageType: 'Error',
        detail: 'MIDI API blocked. Ensure the app is run over HTTPS or localhost.',
        color: 'text-red-700'
      })
      return
    }

    if (!navigator.requestMIDIAccess) {
      statusMessage.value = "Web MIDI API is NOT supported in this browser."
      isSupported.value = false
      addMessage({
        timestamp: new Date().toLocaleTimeString(),
        portName: 'System',
        messageType: 'Error',
        detail: 'navigator.requestMIDIAccess is undefined.',
        color: 'text-red-700'
      })
      return
    }

    try {
      addMessage({
        timestamp: new Date().toLocaleTimeString(),
        portName: 'System',
        messageType: 'Info',
        detail: 'Requesting MIDI Access...',
        color: 'text-blue-600'
      })

      midiAccess.value = await navigator.requestMIDIAccess({ sysex: true })

      midiAccess.value.onstatechange = (event) => {
        const port = event.port
        if (!port) return

        addMessage({
          timestamp: new Date().toLocaleTimeString(),
          portName: port.name || 'Unknown',
          messageType: 'State Change',
          detail: `MIDI Port State Change: ${port.name || 'Unknown'} is now ${port.state}`,
          color: 'text-blue-500'
        })
        if (midiAccess.value) {
          setupMIDIInputs(midiAccess.value)
        }
      }

      setupMIDIInputs(midiAccess.value)

      if (midiAccess.value.inputs.size > 0) {
        statusMessage.value = `Connected and listening to ${midiAccess.value.inputs.size} input(s).`
        isConnected.value = true
      } else {
        statusMessage.value = "MIDI Access granted. Waiting for a device..."
        isConnected.value = true
      }
    } catch (error) {
      statusMessage.value = "MIDI Access Denied or Failed. (Check Permissions)"
      addMessage({
        timestamp: new Date().toLocaleTimeString(),
        portName: 'System',
        messageType: 'Error',
        detail: `Error getting MIDI access: ${(error as Error).message}`,
        color: 'text-red-700'
      })
    }
  }

  const disconnect = () => {
    connectedInputs.value.forEach(input => {
      input.onmidimessage = null
      addMessage({
        timestamp: new Date().toLocaleTimeString(),
        portName: input.name || 'Unknown',
        messageType: 'Disconnected',
        detail: `Disconnected listener from ${input.name || 'Unknown'}`,
        color: 'text-red-700'
      })
    })
    connectedInputs.value = []
    fretPositions.value.clear()
    stringsPlucked.value.clear()
    pluckOrder.value = []
    pluckedNotes.value.clear()

    // Clear auto-clear timer
    if (autoClearTimer !== null) {
      clearTimeout(autoClearTimer)
      autoClearTimer = null
    }

    isConnected.value = false
    statusMessage.value = "MIDI access is ready. Click Connect to find devices."
  }

  const clearStringsPlucked = () => {
    // Create new empty collections to trigger reactivity
    stringsPlucked.value = new Set()
    pluckOrder.value = []
    pluckedNotes.value = new Map()

    // Clear auto-clear timer
    if (autoClearTimer !== null) {
      clearTimeout(autoClearTimer)
      autoClearTimer = null
    }
  }

  const clearMessages = () => {
    messages.value = []
  }

  const checkSupport = () => {
    if (!navigator.requestMIDIAccess) {
      isSupported.value = false
      statusMessage.value = "Web MIDI API is NOT supported in this browser."
    } else {
      isSupported.value = true
      statusMessage.value = "Web MIDI API is supported. Click Connect."
    }
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    midiAccess,
    connectedInputs,
    messages,
    fretPositions,
    stringsPlucked,
    pluckOrder,
    pluckedNotes,
    statusMessage,
    isSupported,
    isConnected,
    connect,
    disconnect,
    clearStringsPlucked,
    clearMessages,
    checkSupport
  }
}
