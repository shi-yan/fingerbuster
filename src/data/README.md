# Chord Definitions

This directory contains chord definitions in JSON format. You can easily add new chords by following the format below.

## JSON Format

Each chord is defined as an object with the following structure:

```json
{
  "name": "ChordName",
  "string_1": {
    "play": true,
    "fret": 0,
    "finger": 0
  },
  "string_2": {
    "play": true,
    "fret": 1,
    "finger": 1
  },
  ...
  "string_6": {
    "play": false,
    "fret": 0,
    "finger": 0
  }
}
```

## Field Descriptions

- **name**: The name of the chord (e.g., "G", "C", "Em", "A7")
- **string_1** to **string_6**: Configuration for each string
  - String 1 = high e string (thinnest)
  - String 6 = low E string (thickest)

For each string:
- **play**: `true` if the string should be played, `false` if it should not (X)
- **fret**: The fret number to press
  - `0` = open string (no fret pressed)
  - `1` = first fret
  - `2` = second fret
  - etc.
- **finger**: Which finger to use (standard guitar fingering)
  - `0` = no finger (open string)
  - `1` = index finger
  - `2` = middle finger
  - `3` = ring finger
  - `4` = pinky finger

## Examples

### G Major Chord
```json
{
  "name": "G",
  "string_1": { "play": true, "fret": 3, "finger": 4 },
  "string_2": { "play": true, "fret": 0, "finger": 0 },
  "string_3": { "play": true, "fret": 0, "finger": 0 },
  "string_4": { "play": true, "fret": 0, "finger": 0 },
  "string_5": { "play": true, "fret": 2, "finger": 2 },
  "string_6": { "play": true, "fret": 3, "finger": 3 }
}
```

### C Major Chord (6th string muted)
```json
{
  "name": "C",
  "string_1": { "play": true, "fret": 0, "finger": 0 },
  "string_2": { "play": true, "fret": 1, "finger": 1 },
  "string_3": { "play": true, "fret": 0, "finger": 0 },
  "string_4": { "play": true, "fret": 2, "finger": 2 },
  "string_5": { "play": true, "fret": 3, "finger": 3 },
  "string_6": { "play": false, "fret": 0, "finger": 0 }
}
```

## Adding New Chords

1. Open `chords.json`
2. Add a new chord object to the array
3. Follow the format above
4. Save the file
5. The chord will automatically appear in the chord selection buttons!

## Available Chords

Currently defined chords:
- G
- C
- D
- Em
- A
- E
- Am
- Dm

Feel free to add more!
