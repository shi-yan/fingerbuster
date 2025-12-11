# FingerBuster 🎸

A web-based guitar practice application that uses MIDI input from a MIDI guitar to help you master chords, improve finger positioning, and develop plucking accuracy.

## Features

### 🎵 MIDI Guitar Support
- Real-time MIDI input from compatible MIDI guitars
- Supports both finger press (CC 49) and release (CC 50) events
- Visual feedback for all fret positions
- Smart tracking of multiple frets pressed on the same string

### 🎯 Practice Modes

#### Chord Practice
- Interactive fretboard visualization
- Multiple chord progressions (Pop Anthem, Emotional Ballad, 50s Doo-Wop, Folk/Country)
- Real-time chord validation and feedback
- Visual indicators for correct/incorrect/unplayed strings
- Automatic progression through chord sequences
- Performance statistics with average and best times

#### Plucking Accuracy Practice
- Three difficulty levels (1-3 strings)
- Beautiful guitar visualization with realistic string rendering
- Sequential plucking validation
- Automatic round progression
- Performance tracking and statistics
- Smart randomization prevents consecutive duplicate strings

#### Fretboard Explorer
- Visual representation of all 12 frets
- Interactive chord selection buttons
- Color-coded finger positions
- Barre chord support (e.g., F chord)
- Real-time MIDI input visualization

### 📊 Progress Tracking
- IndexedDB-based persistent storage
- Daily practice statistics
- Visual charts using D3.js
- Separate tracking for chord transitions and string plucking

## Requirements

### Hardware
- MIDI guitar (any guitar with MIDI pickup/converter)
- MIDI interface (USB-MIDI adapter or direct USB connection)

### Software
- **Browser**: Chromium-based browser (Chrome, Edge, Opera, Brave)
  - Web MIDI API support required
  - Safari and Firefox are NOT supported
- **Connection**: HTTPS or localhost (required for Web MIDI API)

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd fingerbuster
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

5. **Preview production build**
   ```bash
   npm run preview
   ```

## Usage

### 1. Connect Your MIDI Guitar

1. Navigate to the "MIDI Connection" page
2. Click "Connect MIDI Device"
3. Select your MIDI guitar from the browser dialog
4. You should see "Connected to X device(s)" when successful

### 2. Practice Chords

1. Go to "Chord Practice" page
2. Select a chord progression from the dropdown
3. Click "Start Practice"
4. Form the displayed chord on your guitar
5. Strum/pluck all required strings
6. The app validates your finger positions and string plucking
7. Automatically advances to the next chord when correct

### 3. Practice Plucking

1. Go to "Plucking Practice" page
2. Select difficulty level (1-3 strings)
3. Click "Start Practice"
4. Pluck the highlighted strings in order (top to bottom)
5. Get instant visual feedback
6. Track your accuracy and speed over time

### 4. Explore Chords

1. Go to "Chord Practice" page (not in practice mode)
2. Click any chord button to see the fingering
3. Try forming the chord on your guitar
4. See real-time feedback on the fretboard

## Adding New Chords

Chords are defined in `src/data/chords.json`. To add a new chord:

```json
{
  "name": "Am7",
  "string_1": { "play": true, "fret": 0, "finger": 0 },
  "string_2": { "play": true, "fret": 1, "finger": 1 },
  "string_3": { "play": true, "fret": 0, "finger": 0 },
  "string_4": { "play": true, "fret": 2, "finger": 2 },
  "string_5": { "play": true, "fret": 0, "finger": 0 },
  "string_6": { "play": false, "fret": 0, "finger": 0 }
}
```

For barre chords, add a `barre` property:

```json
{
  "name": "F",
  "barre": {
    "fret": 1,
    "startString": 6,
    "endString": 1,
    "finger": 1
  },
  "string_1": { "play": true, "fret": 1, "finger": 1 },
  ...
}
```

See `src/data/README.md` for detailed format documentation.

## Architecture

### Technology Stack
- **Vue 3** - Progressive JavaScript framework with Composition API
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool
- **D3.js** - Data visualization for progress charts
- **Dexie** - IndexedDB wrapper for data persistence
- **Web MIDI API** - Browser MIDI device communication

### Key Components

- **useMidi** (`src/composables/useMidi.ts`) - Core MIDI handling composable
- **FretBoard** (`src/components/FretBoard.vue`) - Interactive fretboard visualization
- **PracticeMode** (`src/components/PracticeMode.vue`) - Chord practice with validation
- **PluckingPractice** (`src/components/PluckingPractice.vue`) - String plucking trainer
- **ProgressChart** (`src/components/ProgressChart.vue`) - D3-based statistics visualization

### Data Structures

- **Fret Positions**: `Map<number, Set<number>>`
  - Key: String number (1-6)
  - Value: Set of all pressed frets on that string
  - Uses highest fret for validation

- **Strings Plucked**: `Set<number>`
  - Tracks which strings have been plucked
  - Auto-clears after 1 second of inactivity

## MIDI Protocol

The app expects the following MIDI messages:

### Control Change (CC) Messages
- **Channel**: 1-6 (maps to guitar strings 1-6)
- **CC 49**: Finger press
  - Value: Fret number (0-12)
  - 0 = open string (clears all frets for that string)
- **CC 50**: Finger release
  - Value: Fret number being released

### Note On/Off Messages
- **Channel**: 1-6 (inverted: Channel 1 = String 6, Channel 6 = String 1)
- **Note**: MIDI note number
- Used for pluck detection

## Browser Compatibility

✅ **Supported**
- Google Chrome (Desktop)
- Microsoft Edge (Desktop)
- Opera (Desktop)
- Brave (Desktop)

❌ **Not Supported**
- Safari (no Web MIDI API support)
- Firefox (no Web MIDI API support)
- Mobile browsers (limited Web MIDI API support)

## Troubleshooting

### MIDI Device Not Detected
1. Ensure your MIDI device is connected before opening the browser
2. Try refreshing the page
3. Check if the device works in other MIDI applications
4. Make sure you're using a Chromium-based browser

### "Web MIDI API BLOCKED" Error
- The app must be served over HTTPS or localhost
- HTTP connections are blocked by browsers for security

### Chord Not Validating
1. Check the debug panel to see which strings/frets are detected
2. Ensure all required fingers are pressed before plucking
3. For barre chords (like F), press the barre first, then add other fingers
4. Make sure you're pressing hard enough for the MIDI pickup to detect

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## License

MIT License - See LICENSE file for details

## Acknowledgments

- Built with Vue 3 and the Web MIDI API
- Inspired by the need for better guitar practice tools
- Chord definitions follow standard guitar fingering conventions
