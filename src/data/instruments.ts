export interface InstrumentInfo {
  number: number;
  name: string;
  soundbankUrl?: string;
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

const createInstruments = (start: number, end: number): InstrumentInfo[] => {
  return GM_INSTRUMENTS.slice(start, end).map((name, i) => {
    const num = start + i;
    return {
      number: num,
      name,
      soundbankUrl: `/presets/instruments/${num}.sf3`
    };
  });
};

export const instrumentGroups: InstrumentGroup[] = [
  {
    name: '🎹 Piano',
    instruments: createInstruments(0, 8)
  },
  {
    name: '🔔 Gõ Định Âm (Percussion)',
    instruments: createInstruments(8, 16)
  },
  {
    name: '💨 Organ',
    instruments: createInstruments(16, 24)
  },
  {
    name: '🎸 Guitar',
    instruments: createInstruments(24, 32)
  },
  {
    name: '🎸 Bass',
    instruments: createInstruments(32, 40)
  },
  {
    name: '🎻 Dây Độc Tấu (Strings)',
    instruments: createInstruments(40, 48)
  },
  {
    name: '🎻 Dàn Dây & Hợp Xướng (Ensemble)',
    instruments: createInstruments(48, 56)
  },
  {
    name: '🎺 Kèn Đồng (Brass)',
    instruments: createInstruments(56, 64)
  },
  {
    name: '💨 Kèn Gỗ Dăm (Reed)',
    instruments: createInstruments(64, 72)
  },
  {
    name: '💨 Kèn Gỗ Ống (Pipe)',
    instruments: createInstruments(72, 80)
  },
  {
    name: '⚡ Synth Lead',
    instruments: createInstruments(80, 88)
  },
  {
    name: '⚡ Synth Pad',
    instruments: createInstruments(88, 96)
  },
  {
    name: '⚡ Synth FX',
    instruments: createInstruments(96, 104)
  },
  {
    name: '🌏 Cổ Truyền (Ethnic)',
    instruments: createInstruments(104, 112)
  },
  {
    name: '🥁 Bộ Gõ Không Định Âm (Percussive)',
    instruments: createInstruments(112, 120)
  },
  {
    name: '🔊 Hiệu Ứng (Sound FX)',
    instruments: createInstruments(120, 128)
  }
];
