# FingerBuster 🎸

A web-based guitar practice application for the **Aeroband MIDI Guitar**. Practice chords, improve your finger positioning, and develop plucking accuracy with real-time feedback.

**Try it now:** [https://shi-yan.github.io/fingerbuster](https://shi-yan.github.io/fingerbuster)

## What Can You Do?

### 🎯 Practice Chords
Learn and master chord progressions with instant feedback. The app validates your finger positions and tells you when you've nailed the chord.

- Multiple progressions: Pop Anthem, Emotional Ballad, 50s Doo-Wop, Folk/Country
- Visual fretboard showing exactly where to put your fingers
- Track your speed - see your average and best times
- Automatically moves to the next chord when you get it right

### 🎵 Improve Plucking Accuracy
Train your plucking precision with three difficulty levels.

- Level 1: Practice single strings
- Level 2: Two strings in sequence
- Level 3: Three strings in sequence
- Beautiful guitar visualization with instant feedback
- Track your progress over time

### 📊 Track Your Progress
All your practice data is saved locally in your browser so you can see your improvement over time.

## Getting Started

### What You Need

- **Aeroband MIDI Guitar**
- **Mac computer** (only tested on macOS)
- **Google Chrome browser** (required - Safari and Firefox won't work)

### Step 1: Connect Your Aeroband Guitar

1. **Turn on Bluetooth MIDI on your Mac:**
   - Open **Audio MIDI Setup** (in Applications > Utilities)
   - Go to **Window > Show MIDI Studio**
   - Click the **Bluetooth icon** in the toolbar
   - In the Bluetooth MIDI Devices window, find your Aeroband guitar and click **Connect**
   - Detailed instructions: [Apple's Bluetooth MIDI Setup Guide](https://support.apple.com/guide/audio-midi-setup/set-up-bluetooth-midi-devices-ams33f013765/mac) (see "Make your Mac a Bluetooth host" section)

2. **Open FingerBuster:**
   - Go to [https://shi-yan.github.io/fingerbuster](https://shi-yan.github.io/fingerbuster) in Chrome
   - Click on **"MIDI Connection"** in the navigation

3. **Connect to the app:**
   - Click **"Connect MIDI Device"**
   - Select your Aeroband guitar from the browser dialog
   - You should see "Connected to 1 device(s)" ✓

### Step 2: Start Practicing!

**Practice Chords:**
1. Click **"Practice Mode"** in the navigation
2. Choose a chord progression from the dropdown menu
3. Click **"Start Practice"**
4. Form the displayed chord on your guitar
5. Strum all the strings shown with "O" (avoid strings marked with "X")
6. When you get it right, it automatically moves to the next chord!

**Practice Plucking:**
1. Click **"Plucking Practice"** in the navigation
2. Choose your difficulty level (1-3 strings)
3. Click **"Start Practice"**
4. Pluck the highlighted strings in order from top to bottom
5. Green checkmark = correct, red X = wrong string

**Explore Chords:**
1. Click **"Chord Practice"** in the navigation
2. Click any chord button to see how to play it
3. The fretboard shows you exactly where to put your fingers
4. Different colors = different fingers (blue = index, green = middle, orange = ring, purple = pinky)

## Understanding the Fretboard Display

- **Numbers on dots**: Which finger to use (1 = index, 2 = middle, 3 = ring, 4 = pinky)
- **O (circle)**: Play this string
- **X**: Don't play this string (mute it)
- **Green highlight**: You're pressing the right fret!
- **Gray dots**: Your current finger positions

## Troubleshooting

### Can't Connect to Bluetooth?
- Make sure your Aeroband guitar is charged and turned on
- Check that Bluetooth is enabled on your Mac
- Try turning the guitar off and on again
- Make sure it's connected in Audio MIDI Setup first

### Can't See My Guitar in the Browser?
- You must use **Google Chrome** (Safari and Firefox don't support Web MIDI)
- Make sure the guitar is connected via Bluetooth MIDI in Audio MIDI Setup
- Try refreshing the page
- Click "Connect MIDI Device" again

### Chord Won't Validate?
- Make sure all your fingers are pressed down firmly
- Check the debug panel (in Practice Mode) to see what the app detects
- For barre chords (like F), press down the barre first, then add other fingers
- Make sure you're only plucking the strings marked with "O"

## Adding New Chords

You can add your own chords by editing `src/data/chords.json`. Each chord needs:
- Which strings to play (true/false)
- Which fret to press (0 = open string)
- Which finger to use (1-4)

See `src/data/README.md` for the complete format and examples.

## For Developers

### Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Technology Stack
- Vue 3 + TypeScript
- Web MIDI API for guitar communication
- D3.js for progress charts
- IndexedDB for data storage

See `.claude/CLAUDE.md` for detailed architecture documentation and development guide.

## Browser Compatibility

✅ **Works:**
- Google Chrome (Mac)
- Microsoft Edge (Mac)

❌ **Doesn't Work:**
- Safari (no Web MIDI API support)
- Firefox (no Web MIDI API support)
- Mobile browsers

## Known Limitations

- Currently only tested with Aeroband MIDI Guitar on macOS
- Requires Chromium-based browser (Chrome, Edge, Brave, Opera)
- Must be served over HTTPS or localhost for security

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## License

MIT License

## Acknowledgments

Built for guitarists who want to improve their skills with the help of technology. Special thanks to the Aeroband team for creating an awesome MIDI guitar!
