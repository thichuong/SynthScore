use quick_xml::events::Event;
use quick_xml::reader::Reader;
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

#[derive(Debug, Clone)]
struct XmlParsedNote {
    step: String,
    alter: i8,
    octave: i8,
    beat_start: f64,
    beat_duration: f64,
}

#[wasm_bindgen]
#[must_use]
pub fn parse_musicxml_to_midi_wasm(xml_text: &str) -> Vec<u8> {
    let mut reader = Reader::from_str(xml_text);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut current_tag = String::new();

    let mut divisions: u32 = 1;
    let mut bpm: f64 = 120.0;

    let mut parsed_notes: Vec<XmlParsedNote> = Vec::new();

    // Context inside element parsing
    let mut in_note = false;
    let mut in_backup = false;
    let mut in_forward = false;

    let mut step = String::new();
    let mut alter: i8 = 0;
    let mut octave: i8 = 4;
    let mut duration: u32 = 0;
    let mut is_rest = false;
    let mut is_chord = false;

    let mut current_beat_offset = 0.0f64;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                current_tag.clone_from(&tag);

                match tag.as_str() {
                    "part" => {
                        current_beat_offset = 0.0;
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
                                            bpm = b;
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
                if tag == "sound" {
                    for attr in e.attributes().flatten() {
                        if attr.key.as_ref() == b"tempo" {
                            if let Ok(val) = std::str::from_utf8(&attr.value) {
                                if let Ok(b) = val.parse::<f64>() {
                                    if b > 0.0 {
                                        bpm = b;
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

                if current_tag == "divisions" {
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
                        _ => {}
                    }
                } else if in_backup && current_tag == "duration" {
                    let d = text.parse::<u32>().unwrap_or(0);
                    let dur_beats = f64::from(d) / f64::from(divisions.max(1));
                    current_beat_offset = (current_beat_offset - dur_beats).max(0.0);
                } else if in_forward && current_tag == "duration" {
                    let d = text.parse::<u32>().unwrap_or(0);
                    let dur_beats = f64::from(d) / f64::from(divisions.max(1));
                    current_beat_offset += dur_beats;
                }
            }
            Ok(Event::End(ref e)) => {
                let tag = String::from_utf8_lossy(e.name().as_ref()).to_string();
                match tag.as_str() {
                    "backup" => in_backup = false,
                    "forward" => in_forward = false,
                    "note" => {
                        in_note = false;
                        let dur_beats = f64::from(duration) / f64::from(divisions.max(1));

                        if !is_rest && !step.is_empty() {
                            parsed_notes.push(XmlParsedNote {
                                step: step.clone(),
                                alter,
                                octave,
                                beat_start: current_beat_offset,
                                beat_duration: dur_beats.max(0.25),
                            });
                        }

                        if !is_chord {
                            current_beat_offset += dur_beats;
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

    if parsed_notes.is_empty() {
        return crate::midi_processor::generate_symphony_midi_wasm(&[]);
    }

    // Build MIDI binary from parsed XML notes
    let ppq = 480u16;

    let mut prepared_events = Vec::new();
    for note in parsed_notes {
        let midi_key = get_midi_pitch(&note.step, note.alter, note.octave);
        let start_tick = (note.beat_start * f64::from(ppq)).round() as u32;
        let dur_ticks = ((note.beat_duration * f64::from(ppq)).max(1.0)).round() as u32;

        prepared_events.push(crate::midi_processor::PreparedNoteEvent {
            channel: 0,
            key: midi_key,
            start_tick,
            duration_ticks: dur_ticks,
            velocity: 90,
        });
    }

    let track_def = [crate::midi_processor::TrackDefinition {
        name: "MusicXML Track",
        program: 0,
        channel: 0,
    }];

    crate::midi_processor::build_midi_file(&track_def, prepared_events, bpm as u32)
}
