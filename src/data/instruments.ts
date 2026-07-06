export interface InstrumentInfo {
  number: number;
  name: string;
}

export interface InstrumentGroup {
  name: string;
  instruments: InstrumentInfo[];
}

export const GM_INSTRUMENTS: string[] = [
  // Piano (0-7)
  'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano',
  'Electric Piano 1 (Rhodes)', 'Electric Piano 2 (Chorused)', 'Harpsichord', 'Clavinet',
  // Chromatic Percussion (8-15)
  'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
  // Organ (16-23)
  'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
  // Guitar (24-31)
  'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)',
  'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar harmonics',
  // Bass (32-39)
  'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass',
  'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
  // Strings (40-47)
  'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
  // Ensemble (48-55)
  'String Ensemble 1', 'String Ensemble 2', 'SynthStrings 1', 'SynthStrings 2',
  'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit',
  // Brass (56-63)
  'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section', 'SynthBrass 1', 'SynthBrass 2',
  // Reed (64-71)
  'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
  // Pipe (72-79)
  'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
  // Synth Lead (80-87)
  'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)',
  'Lead 5 (charang)', 'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
  // Synth Pad (88-95)
  'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)',
  'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)',
  // Synth FX (96-103)
  'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)',
  'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
  // Ethnic (104-111)
  'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bagpipe', 'Fiddle', 'Shanai',
  // Percussive (112-119)
  'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
  // Sound Effects (120-127)
  'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot'
];

export const instrumentGroups: InstrumentGroup[] = [
  {
    name: '🎹 Piano',
    instruments: GM_INSTRUMENTS.slice(0, 8).map((name, i) => ({ number: i, name }))
  },
  {
    name: '🔔 Gõ Định Âm (Percussion)',
    instruments: GM_INSTRUMENTS.slice(8, 16).map((name, i) => ({ number: 8 + i, name }))
  },
  {
    name: '💨 Organ',
    instruments: GM_INSTRUMENTS.slice(16, 24).map((name, i) => ({ number: 16 + i, name }))
  },
  {
    name: '🎸 Guitar',
    instruments: GM_INSTRUMENTS.slice(24, 32).map((name, i) => ({ number: 24 + i, name }))
  },
  {
    name: '🎸 Bass',
    instruments: GM_INSTRUMENTS.slice(32, 40).map((name, i) => ({ number: 32 + i, name }))
  },
  {
    name: '🎻 Dây Độc Tấu (Strings)',
    instruments: GM_INSTRUMENTS.slice(40, 48).map((name, i) => ({ number: 40 + i, name }))
  },
  {
    name: '🎻 Dàn Dây & Hợp Xướng (Ensemble)',
    instruments: GM_INSTRUMENTS.slice(48, 56).map((name, i) => ({ number: 48 + i, name }))
  },
  {
    name: '🎺 Kèn Đồng (Brass)',
    instruments: GM_INSTRUMENTS.slice(56, 64).map((name, i) => ({ number: 56 + i, name }))
  },
  {
    name: '💨 Kèn Gỗ Dăm (Reed)',
    instruments: GM_INSTRUMENTS.slice(64, 72).map((name, i) => ({ number: 64 + i, name }))
  },
  {
    name: '💨 Kèn Gỗ Ống (Pipe)',
    instruments: GM_INSTRUMENTS.slice(72, 80).map((name, i) => ({ number: 72 + i, name }))
  },
  {
    name: '⚡ Synth Lead',
    instruments: GM_INSTRUMENTS.slice(80, 88).map((name, i) => ({ number: 80 + i, name }))
  },
  {
    name: '⚡ Synth Pad',
    instruments: GM_INSTRUMENTS.slice(88, 96).map((name, i) => ({ number: 88 + i, name }))
  },
  {
    name: '⚡ Synth FX',
    instruments: GM_INSTRUMENTS.slice(96, 104).map((name, i) => ({ number: 96 + i, name }))
  },
  {
    name: '🌏 Cổ Truyền (Ethnic)',
    instruments: GM_INSTRUMENTS.slice(104, 112).map((name, i) => ({ number: 104 + i, name }))
  },
  {
    name: '🥁 Bộ Gõ Không Định Âm (Percussive)',
    instruments: GM_INSTRUMENTS.slice(112, 120).map((name, i) => ({ number: 112 + i, name }))
  },
  {
    name: '🔊 Hiệu Ứng (Sound FX)',
    instruments: GM_INSTRUMENTS.slice(120, 128).map((name, i) => ({ number: 120 + i, name }))
  }
];
