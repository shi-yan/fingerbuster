// Strumming practice type definitions

export interface StrumEvent {
  string: number;
  timestamp: number;
  note?: number;
}

export interface StrumInstruction {
  beat: number;              // Which beat (0, 1, 2, 3 in 4/4 time)
  subdivision: number;       // 0 = on beat, 0.5 = eighth note, 0.25 = sixteenth note
  direction: 'down' | 'up';
  strings: number[];         // Which strings to play [1,2,3,4,5,6]
  emphasis?: boolean;        // Accent/emphasize this strum
}

export interface StrumPattern {
  id: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  timeSignature: { beats: number; noteValue: number }; // e.g., { beats: 4, noteValue: 4 } = 4/4
  bars: number;              // How many bars the pattern spans
  strums: StrumInstruction[];
  recommendedBPM: { min: number; max: number };
}

export interface StrumAttempt {
  expectedStrum: StrumInstruction;
  actualStrings: number[];
  detectedDirection: 'down' | 'up' | 'unclear';
  timing: number;            // Milliseconds offset from expected time (negative = early, positive = late)
  success: boolean;
  errors: string[];          // What went wrong
}

export interface StrumValidationResult {
  direction: 'down' | 'up' | 'unclear';
  confidence: number;        // 0-1
  stringsPlayed: Set<number>;
  wrongStrings: number[];    // Strings that shouldn't have been played
  missedStrings: number[];   // Required strings that weren't played
  valid: boolean;
}
