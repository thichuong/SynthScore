use quick_xml::events::Event;
use quick_xml::reader::Reader;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

#[must_use]
pub fn get_note_name_rust(step: &str, alter: i8, octave: i8) -> String {
    let steps = [
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
    ];
    let step_idx = match step {
        "D" => 2,
        "E" => 4,
        "F" => 5,
        "G" => 7,
        "A" => 9,
        "B" => 11,
        _ => 0,
    };
    let mut final_index = step_idx as i16 + i16::from(alter);
    let mut final_octave = i16::from(octave);

    while final_index < 0 {
        final_index += 12;
        final_octave -= 1;
    }
    while final_index >= 12 {
        final_index -= 12;
        final_octave += 1;
    }

    format!("{}{}", steps[final_index as usize], final_octave)
}

#[must_use]
pub fn get_midi_pitch(step: &str, alter: i8, octave: i8) -> u8 {
    let step_idx = match step {
        "D" => 2,
        "E" => 4,
        "F" => 5,
        "G" => 7,
        "A" => 9,
        "B" => 11,
        _ => 0,
    };
    let pitch = (i16::from(octave) + 1) * 12 + step_idx as i16 + i16::from(alter);
    pitch.clamp(0, 127) as u8
}

#[derive(Debug, Clone, Default)]
struct ScorePartInfo {
    id: String,
    part_name: String,
    instrument_name: String,
    instrument_sound: String,
    midi_channel: Option<u8>,
    midi_program: Option<u8>,
}

#[derive(Debug, Clone)]
struct XmlParsedNote {
    part_index: usize,
    step: String,
    alter: i8,
    octave: i8,
    beat_start: f64,
    beat_duration: f64,
}

fn resolve_instrument_and_channel(part: &ScorePartInfo, next_auto_channel: &mut u8) -> (u8, u8) {
    let text = format!(
        "{} {} {}",
        part.part_name, part.instrument_name, part.instrument_sound
    )
    .to_lowercase();

    let is_drum_sound = part.instrument_sound.to_lowercase().starts_with("drum")
        || part
            .instrument_sound
            .to_lowercase()
            .starts_with("percussion");
    let is_drum_text = text.contains("drum") || text.contains("percussion") || text.contains("kit");
    let is_drum_channel = part.midi_channel == Some(10);
    let is_drum = is_drum_sound || is_drum_text || is_drum_channel;

    let channel = if is_drum {
        9
    } else if let Some(ch) = part.midi_channel {
        let c = (ch.saturating_sub(1)) % 16;
        if c == 9 {
            if *next_auto_channel == 9 {
                *next_auto_channel += 1;
            }
            let allocated = *next_auto_channel % 16;
            *next_auto_channel += 1;
            allocated
        } else {
            c
        }
    } else {
        if *next_auto_channel == 9 {
            *next_auto_channel += 1;
        }
        let allocated = *next_auto_channel % 16;
        *next_auto_channel += 1;
        allocated
    };

    let program = if is_drum {
        0
    } else if let Some(prog) = part.midi_program {
        (prog.saturating_sub(1)).min(127)
    } else if !part.instrument_sound.is_empty() {
        let sound = part.instrument_sound.to_lowercase();
        if sound.contains("distortion") {
            30
        } else if sound.contains("clean") {
            27
        } else if sound.contains("jazz") {
            26
        } else if sound.contains("guitar") {
            25
        } else if sound.contains("bass.electric") || sound.contains("bass") {
            33
        } else if sound.contains("synth.lead") {
            80
        } else if sound.contains("synth.pad") {
            88
        } else if sound.contains("brass.synth") {
            62
        } else if sound.contains("brass") {
            61
        } else if sound.contains("violin") {
            40
        } else if sound.contains("viola") {
            41
        } else if sound.contains("cello") {
            42
        } else if sound.contains("contrabass") {
            43
        } else if sound.contains("flute") {
            73
        } else if sound.contains("oboe") {
            68
        } else if sound.contains("clarinet") {
            71
        } else {
            0
        }
    } else if text.contains("distortion guitar") || text.contains("distortion") {
        30
    } else if text.contains("electric guitar") {
        27
    } else if text.contains("acoustic guitar") || text.contains("guitar") || text.contains("gtr") {
        25
    } else if text.contains("synth lead")
        || text.contains("lead synth")
        || text.contains("square")
        || text.contains("sawtooth")
        || text.contains("lead")
    {
        80
    } else if text.contains("synth brass") {
        62
    } else if text.contains("synth") {
        80
    } else if text.contains("brass") {
        61
    } else if text.contains("electric bass") || text.contains("pick bass") || text.contains("bass")
    {
        33
    } else if text.contains("violin") || text.contains("string") {
        40
    } else if text.contains("cello") {
        42
    } else if text.contains("flute") {
        73
    } else if text.contains("horn") || text.contains("cor") {
        60
    } else if text.contains("trumpet") {
        56
    } else if text.contains("sax") {
        65
    } else if text.contains("organ") {
        16
    } else {
        0
    };

    (program, channel)
}

fn parse_bpm_from_text(s: &str) -> Option<f64> {
    let mut num_str = String::new();
    let mut found_digit = false;
    for ch in s.chars() {
        if ch.is_ascii_digit() || (ch == '.' && found_digit && !num_str.contains('.')) {
            num_str.push(ch);
            found_digit = true;
        } else if found_digit {
            if let Ok(v) = num_str.parse::<f64>() {
                if (1.0..=500.0).contains(&v) {
                    return Some(v);
                }
            }
            num_str.clear();
            found_digit = false;
        }
    }
    if !num_str.is_empty() {
        if let Ok(v) = num_str.parse::<f64>() {
            if (1.0..=500.0).contains(&v) {
                return Some(v);
            }
        }
    }
    None
}

#[wasm_bindgen]
#[must_use]
pub fn parse_musicxml_to_midi_wasm(xml_text: &str) -> Vec<u8> {
    let mut reader = Reader::from_str(xml_text);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut current_tag = String::new();

    let mut divisions: u32 = 1;
    let mut raw_tempo_events: Vec<crate::midi_processor::TempoEvent> = Vec::new();

    let mut in_metronome = false;
    let mut metronome_beat_unit = String::from("quarter");
    let mut metronome_has_dot = false;
    let mut metronome_per_minute: Option<f64> = None;
    let mut in_direction = false;
    let mut direction_sound_tempo: Option<f64> = None;
    let mut direction_words = String::new();

    let mut score_parts: Vec<ScorePartInfo> = Vec::new();
    let mut part_id_map: HashMap<String, usize> = HashMap::new();
    let mut current_score_part: Option<ScorePartInfo> = None;

    let mut parsed_notes: Vec<XmlParsedNote> = Vec::new();

    let mut in_part_list = false;
    let mut in_note = false;
    let mut in_backup = false;
    let mut in_forward = false;

    let mut current_part_index: usize = 0;
    let mut current_voice = String::from("1");
    let mut voice_offsets: HashMap<String, f64> = HashMap::new();
    let mut last_note_starts: HashMap<String, f64> = HashMap::new();
    let mut current_beat_offset = 0.0f64;

    let mut step = String::new();
    let mut alter: i8 = 0;
    let mut octave: i8 = 4;
    let mut duration: u32 = 0;
    let mut is_rest = false;
    let mut is_chord = false;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                current_tag.clone_from(&tag);

                match tag.as_str() {
                    "part-list" => {
                        in_part_list = true;
                    }
                    "score-part" => {
                        if in_part_list {
                            let mut sp = ScorePartInfo::default();
                            for attr in e.attributes().flatten() {
                                if attr.key.as_ref() == b"id" {
                                    if let Ok(val) = std::str::from_utf8(&attr.value) {
                                        sp.id = val.to_string();
                                    }
                                }
                            }
                            current_score_part = Some(sp);
                        }
                    }
                    "part" => {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"id" {
                                if let Ok(val) = std::str::from_utf8(&attr.value) {
                                    if let Some(&idx) = part_id_map.get(val) {
                                        current_part_index = idx;
                                    }
                                }
                            }
                        }
                        current_beat_offset = 0.0;
                        divisions = 1;
                        voice_offsets.clear();
                        last_note_starts.clear();
                        current_voice = "1".to_string();
                    }
                    "direction" => {
                        in_direction = true;
                        direction_sound_tempo = None;
                        direction_words.clear();
                    }
                    "metronome" => {
                        in_metronome = true;
                        metronome_beat_unit = "quarter".to_string();
                        metronome_has_dot = false;
                        metronome_per_minute = None;
                    }
                    "beat-unit-dot" => {
                        if in_metronome {
                            metronome_has_dot = true;
                        }
                    }
                    "note" => {
                        in_note = true;
                        step.clear();
                        alter = 0;
                        octave = 4;
                        duration = 0;
                        is_rest = false;
                        is_chord = false;
                    }
                    "rest" => is_rest = true,
                    "chord" => is_chord = true,
                    "backup" => in_backup = true,
                    "forward" => in_forward = true,
                    "sound" => {
                        for attr in e.attributes().flatten() {
                            if attr.key.as_ref() == b"tempo" {
                                if let Ok(val) = std::str::from_utf8(&attr.value) {
                                    if let Ok(b) = val.parse::<f64>() {
                                        if b > 0.0 {
                                            direction_sound_tempo = Some(b);
                                            raw_tempo_events.push(
                                                crate::midi_processor::TempoEvent {
                                                    tick: (current_beat_offset * 480.0).round()
                                                        as u32,
                                                    bpm: b,
                                                },
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Empty(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                if tag == "rest" {
                    is_rest = true;
                }
                if tag == "chord" {
                    is_chord = true;
                }
                if tag == "beat-unit-dot" && in_metronome {
                    metronome_has_dot = true;
                }
                if tag == "sound" {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"tempo" {
                            if let Ok(val) = std::str::from_utf8(&attr.value) {
                                if let Ok(b) = val.parse::<f64>() {
                                    if b > 0.0 {
                                        direction_sound_tempo = Some(b);
                                        raw_tempo_events.push(crate::midi_processor::TempoEvent {
                                            tick: (current_beat_offset * 480.0).round() as u32,
                                            bpm: b,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Ok(Event::Text(e)) => {
                let text = e.unescape().unwrap_or_default().trim().to_string();
                if text.is_empty() {
                    continue;
                }

                if in_metronome {
                    match current_tag.as_str() {
                        "beat-unit" => metronome_beat_unit = text.to_lowercase(),
                        "per-minute" => metronome_per_minute = parse_bpm_from_text(&text),
                        _ => {}
                    }
                } else if in_direction && current_tag == "words" {
                    direction_words.push_str(&text);
                } else if in_part_list {
                    if let Some(ref mut sp) = current_score_part {
                        match current_tag.as_str() {
                            "part-name" => sp.part_name.clone_from(&text),
                            "instrument-name" => sp.instrument_name.clone_from(&text),
                            "instrument-sound" => sp.instrument_sound.clone_from(&text),
                            "midi-channel" => sp.midi_channel = text.parse::<u8>().ok(),
                            "midi-program" => sp.midi_program = text.parse::<u8>().ok(),
                            _ => {}
                        }
                    }
                } else if current_tag == "divisions" {
                    if let Ok(d) = text.parse::<u32>() {
                        if d > 0 {
                            divisions = d;
                        }
                    }
                } else if in_note {
                    match current_tag.as_str() {
                        "step" => step.clone_from(&text),
                        "alter" => alter = text.parse::<i8>().unwrap_or(0),
                        "octave" => octave = text.parse::<i8>().unwrap_or(4),
                        "duration" => duration = text.parse::<u32>().unwrap_or(0),
                        "voice" => current_voice.clone_from(&text),
                        _ => {}
                    }
                } else if in_backup && current_tag == "duration" {
                    let d = text.parse::<u32>().unwrap_or(0);
                    let dur_beats = f64::from(d) / f64::from(divisions.max(1));
                    let current_val = voice_offsets
                        .get(&current_voice)
                        .copied()
                        .unwrap_or(current_beat_offset);
                    let new_val = (current_val - dur_beats).max(0.0);
                    voice_offsets.insert(current_voice.clone(), new_val);
                    current_beat_offset = (current_beat_offset - dur_beats).max(0.0);
                } else if in_forward && current_tag == "duration" {
                    let d = text.parse::<u32>().unwrap_or(0);
                    let dur_beats = f64::from(d) / f64::from(divisions.max(1));
                    let current_val = voice_offsets
                        .get(&current_voice)
                        .copied()
                        .unwrap_or(current_beat_offset);
                    let new_val = current_val + dur_beats;
                    voice_offsets.insert(current_voice.clone(), new_val);
                    current_beat_offset += dur_beats;
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "metronome" => {
                        in_metronome = false;
                        if let Some(pm) = metronome_per_minute {
                            let mut unit_mult = match metronome_beat_unit.as_str() {
                                "eighth" => 0.5,
                                "half" => 2.0,
                                "whole" => 4.0,
                                "16th" | "sixteenth" => 0.25,
                                "32nd" | "thirty-second" => 0.125,
                                "64th" | "sixty-fourth" => 0.0625,
                                _ => 1.0,
                            };
                            if metronome_has_dot {
                                unit_mult *= 1.5;
                            }
                            let quarter_bpm = pm * unit_mult;
                            raw_tempo_events.push(crate::midi_processor::TempoEvent {
                                tick: (current_beat_offset * 480.0).round() as u32,
                                bpm: quarter_bpm,
                            });
                        }
                    }
                    "direction" => {
                        in_direction = false;
                        if direction_sound_tempo.is_none()
                            && metronome_per_minute.is_none()
                            && !direction_words.is_empty()
                        {
                            if let Some(bpm_val) = parse_bpm_from_text(&direction_words) {
                                raw_tempo_events.push(crate::midi_processor::TempoEvent {
                                    tick: (current_beat_offset * 480.0).round() as u32,
                                    bpm: bpm_val,
                                });
                            }
                        }
                    }
                    "part-list" => {
                        in_part_list = false;
                    }
                    "score-part" => {
                        if let Some(sp) = current_score_part.take() {
                            let idx = score_parts.len();
                            part_id_map.insert(sp.id.clone(), idx);
                            score_parts.push(sp);
                        }
                    }
                    "backup" => in_backup = false,
                    "forward" => in_forward = false,
                    "note" => {
                        in_note = false;
                        let dur_beats = f64::from(duration) / f64::from(divisions.max(1));

                        let current_val = voice_offsets
                            .get(&current_voice)
                            .copied()
                            .unwrap_or(current_beat_offset);

                        let start_beat = if is_chord {
                            last_note_starts
                                .get(&current_voice)
                                .copied()
                                .unwrap_or(current_val)
                        } else {
                            current_val
                        };

                        if !is_chord {
                            last_note_starts.insert(current_voice.clone(), start_beat);
                            voice_offsets.insert(current_voice.clone(), start_beat + dur_beats);
                            current_beat_offset = current_beat_offset.max(start_beat + dur_beats);
                        }

                        if !is_rest && !step.is_empty() {
                            parsed_notes.push(XmlParsedNote {
                                part_index: current_part_index,
                                step: step.clone(),
                                alter,
                                octave,
                                beat_start: start_beat,
                                beat_duration: dur_beats.max(0.1),
                            });
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) | Err(_) => break,
            Ok(_) => {}
        }

        buf.clear();
    }

    if score_parts.is_empty() {
        score_parts.push(ScorePartInfo {
            id: "P1".to_string(),
            part_name: "MusicXML Track".to_string(),
            ..Default::default()
        });
    }

    let mut next_auto_channel = 0u8;
    let mut track_defs = Vec::new();
    for sp in &score_parts {
        let (program, channel) = resolve_instrument_and_channel(sp, &mut next_auto_channel);
        let name = if sp.part_name.is_empty() {
            "Track"
        } else {
            sp.part_name.as_str()
        };
        track_defs.push(crate::midi_processor::TrackDefinition {
            name: std::borrow::Cow::Borrowed(name),
            program,
            channel,
        });
    }

    raw_tempo_events.sort_by_key(|te| te.tick);
    let mut tempo_events: Vec<crate::midi_processor::TempoEvent> = Vec::new();
    for te in raw_tempo_events {
        if let Some(last) = tempo_events.last_mut() {
            if last.tick == te.tick {
                *last = te;
                continue;
            }
        }
        tempo_events.push(te);
    }
    if tempo_events.is_empty() {
        tempo_events.push(crate::midi_processor::TempoEvent {
            tick: 0,
            bpm: 120.0,
        });
    } else if tempo_events[0].tick > 0 {
        let first_bpm = tempo_events[0].bpm;
        tempo_events.insert(
            0,
            crate::midi_processor::TempoEvent {
                tick: 0,
                bpm: first_bpm,
            },
        );
    }

    if parsed_notes.is_empty() {
        return crate::midi_processor::build_midi_file(&track_defs, Vec::new(), &tempo_events);
    }

    let ppq = 480u16;
    let mut prepared_events = Vec::new();
    for note in parsed_notes {
        let part_idx = note.part_index.min(track_defs.len() - 1);
        let midi_key = get_midi_pitch(&note.step, note.alter, note.octave);
        let start_tick = (note.beat_start * f64::from(ppq)).round() as u32;
        let dur_ticks = ((note.beat_duration * f64::from(ppq)).max(1.0)).round() as u32;

        prepared_events.push(crate::midi_processor::PreparedNoteEvent {
            channel: part_idx as u8,
            key: midi_key,
            start_tick,
            duration_ticks: dur_ticks,
            velocity: 90,
        });
    }

    crate::midi_processor::build_midi_file(&track_defs, prepared_events, &tempo_events)
}
