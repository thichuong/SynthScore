use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrackInfoWasm {
    pub channel: u8,
    pub name: String,
    pub instrument_name: String,
    pub instrument_number: u8,
    pub volume: u8,
    pub is_muted: bool,
    pub is_soloed: bool,
    pub note_count: u32,
    pub pan: i8,
    pub reverb_send: u8,
    pub chorus_send: u8,
}

#[derive(Debug, Clone)]
pub struct RawNote {
    pub midi: u8,
    pub time: f64,     // seconds
    pub duration: f64, // seconds
    pub velocity: f32, // 0.0 to 1.0
}

#[derive(Debug, Clone)]
struct ParsedMidiTrackInfo {
    _channel: u8,
    name: String,
    program: u8,
    note_count: u32,
}

// Function to calculate default spatial and effect settings based on instrument and channel
#[must_use]
pub fn get_default_track_settings(program: u8, channel: u8) -> (i8, u8, u8) {
    if (40..=47).contains(&program) {
        let pan = match program {
            40 => {
                if channel.is_multiple_of(2) {
                    -30
                } else {
                    -15
                }
            }
            41 => -10,
            42 => 20,
            43 => 40,
            _ => -5,
        };

        let reverb_send = 90;
        let chorus_send = if program == 40 { 40 } else { 25 };
        (pan, reverb_send, chorus_send)
    } else if program <= 7 {
        (0, 64, 0)
    } else {
        (0, 50, 0)
    }
}

// Read Variable Length Quantity (VLQ) from byte slice
fn read_vlq(bytes: &[u8], offset: &mut usize) -> Result<u32, &'static str> {
    let mut result = 0u32;
    for _ in 0..4 {
        if *offset >= bytes.len() {
            return Err("EOF while reading VLQ");
        }
        let byte = bytes[*offset];
        *offset += 1;
        result = (result << 7) | u32::from(byte & 0x7F);
        if (byte & 0x80) == 0 {
            return Ok(result);
        }
    }
    Err("Invalid VLQ length")
}

// Write Variable Length Quantity (VLQ) to vector
fn write_vlq(vec: &mut Vec<u8>, mut val: u32) {
    let mut buffer = [0u8; 5];
    let mut count = 0;
    loop {
        buffer[count] = (val & 0x7F) as u8;
        val >>= 7;
        count += 1;
        if val == 0 {
            break;
        }
    }
    for i in (0..count).rev() {
        let mut b = buffer[i];
        if i > 0 {
            b |= 0x80;
        }
        vec.push(b);
    }
}

pub struct MidiParserHelper;

impl MidiParserHelper {
    #[must_use]
    pub fn parse_all_notes(bytes: &[u8]) -> (Vec<RawNote>, u32) {
        let mut notes = Vec::new();
        let mut tempo_bpm = 120.0;

        if bytes.len() < 14 || &bytes[0..4] != b"MThd" {
            return (notes, 120);
        }

        let division = u16::from_be_bytes([bytes[12], bytes[13]]);
        let ppq = if division & 0x8000 == 0 {
            f64::from(division)
        } else {
            480.0
        };

        let mut offset = 14;

        while offset + 8 <= bytes.len() {
            if &bytes[offset..offset + 4] != b"MTrk" {
                break;
            }
            let track_len = u32::from_be_bytes([
                bytes[offset + 4],
                bytes[offset + 5],
                bytes[offset + 6],
                bytes[offset + 7],
            ]) as usize;
            offset += 8;

            let track_end = (offset + track_len).min(bytes.len());
            let mut current_tick: u64 = 0;
            let mut running_status: u8 = 0;
            let mut active_notes: Vec<(u8, u8, u64, f32)> = Vec::new(); // (channel, midi, start_tick, velocity)

            while offset < track_end {
                let Ok(delta) = read_vlq(bytes, &mut offset) else {
                    break;
                };

                current_tick += u64::from(delta);

                if offset >= track_end {
                    break;
                }

                let mut b = bytes[offset];
                if b & 0x80 != 0 {
                    running_status = b;
                    offset += 1;
                } else {
                    b = running_status;
                }

                if b == 0xFF {
                    // Meta event
                    if offset >= track_end {
                        break;
                    }
                    let meta_type = bytes[offset];
                    offset += 1;
                    let meta_len = match read_vlq(bytes, &mut offset) {
                        Ok(l) => l as usize,
                        Err(_) => break,
                    };
                    if meta_type == 0x51 && meta_len == 3 && offset + 3 <= track_end {
                        let tempo_us = (u32::from(bytes[offset]) << 16)
                            | (u32::from(bytes[offset + 1]) << 8)
                            | u32::from(bytes[offset + 2]);
                        if tempo_us > 0 {
                            tempo_bpm = 60_000_000.0 / f64::from(tempo_us);
                        }
                    }
                    offset += meta_len;
                } else if b == 0xF0 || b == 0xF7 {
                    // SysEx event
                    let sys_len = match read_vlq(bytes, &mut offset) {
                        Ok(l) => l as usize,
                        Err(_) => break,
                    };
                    offset += sys_len;
                } else {
                    let cmd = b & 0xF0;
                    let channel = b & 0x0F;

                    match cmd {
                        0x80 | 0x90 => {
                            if offset + 2 > track_end {
                                break;
                            }
                            let key = bytes[offset];
                            let vel = bytes[offset + 1];
                            offset += 2;

                            let is_on = cmd == 0x90 && vel > 0;
                            if is_on {
                                active_notes.push((
                                    channel,
                                    key,
                                    current_tick,
                                    f32::from(vel) / 127.0,
                                ));
                            } else {
                                // Match Note Off
                                if let Some(pos) = active_notes
                                    .iter()
                                    .position(|n| n.0 == channel && n.1 == key)
                                {
                                    let (ch, note_key, start_tick, velocity) =
                                        active_notes.remove(pos);
                                    if ch != 9 {
                                        // Skip percussion channel
                                        let seconds_per_tick = 60.0 / (tempo_bpm * ppq);
                                        let start_time = start_tick as f64 * seconds_per_tick;
                                        let duration =
                                            (current_tick - start_tick) as f64 * seconds_per_tick;
                                        notes.push(RawNote {
                                            midi: note_key,
                                            time: start_time,
                                            duration: duration.max(0.01),
                                            velocity,
                                        });
                                    }
                                }
                            }
                        }
                        0xA0 | 0xB0 | 0xE0 => {
                            offset += 2;
                        }
                        _ => {
                            offset += 1;
                        }
                    }
                }
            }

            // Close any unclosed notes
            let seconds_per_tick = 60.0 / (tempo_bpm * ppq);
            for (ch, key, start_tick, velocity) in active_notes {
                if ch != 9 {
                    notes.push(RawNote {
                        midi: key,
                        time: start_tick as f64 * seconds_per_tick,
                        duration: 0.5,
                        velocity,
                    });
                }
            }
        }

        (notes, tempo_bpm.round() as u32)
    }
}

#[wasm_bindgen]
#[must_use]
pub fn parse_midi_tracks_wasm(bytes: &[u8]) -> JsValue {
    let mut channel_map: std::collections::HashMap<u8, ParsedMidiTrackInfo> =
        std::collections::HashMap::new();

    if bytes.len() >= 14 && &bytes[0..4] == b"MThd" {
        let mut offset = 14;
        while offset + 8 <= bytes.len() {
            if &bytes[offset..offset + 4] != b"MTrk" {
                break;
            }
            let track_len = u32::from_be_bytes([
                bytes[offset + 4],
                bytes[offset + 5],
                bytes[offset + 6],
                bytes[offset + 7],
            ]) as usize;
            offset += 8;

            let track_end = (offset + track_len).min(bytes.len());
            let mut current_channel: u8 = 0;
            let mut track_name = String::new();
            let mut current_program: u8 = 0;
            let mut note_count = 0u32;
            let mut running_status = 0u8;

            while offset < track_end {
                let Ok(_delta) = read_vlq(bytes, &mut offset) else {
                    break;
                };
                if offset >= track_end {
                    break;
                }

                let mut b = bytes[offset];
                if b & 0x80 != 0 {
                    running_status = b;
                    offset += 1;
                } else {
                    b = running_status;
                }

                if b == 0xFF {
                    if offset >= track_end {
                        break;
                    }
                    let meta_type = bytes[offset];
                    offset += 1;
                    let meta_len = match read_vlq(bytes, &mut offset) {
                        Ok(l) => l as usize,
                        Err(_) => break,
                    };
                    if meta_type == 0x03 && offset + meta_len <= track_end {
                        if let Ok(name) = std::str::from_utf8(&bytes[offset..offset + meta_len]) {
                            track_name = name.trim().to_string();
                        }
                    }
                    offset += meta_len;
                } else if b == 0xF0 || b == 0xF7 {
                    let sys_len = match read_vlq(bytes, &mut offset) {
                        Ok(l) => l as usize,
                        Err(_) => break,
                    };
                    offset += sys_len;
                } else {
                    let cmd = b & 0xF0;
                    current_channel = b & 0x0F;

                    match cmd {
                        0x90 => {
                            if offset + 2 <= track_end {
                                let vel = bytes[offset + 1];
                                offset += 2;
                                if vel > 0 {
                                    note_count += 1;
                                }
                            }
                        }
                        0x80 | 0xA0 | 0xB0 | 0xE0 => {
                            offset += 2;
                        }
                        0xC0 => {
                            if offset < track_end {
                                current_program = bytes[offset];
                                offset += 1;
                            }
                        }
                        _ => {
                            offset += 1;
                        }
                    }
                }
            }

            if note_count > 0 {
                let entry =
                    channel_map
                        .entry(current_channel)
                        .or_insert_with(|| ParsedMidiTrackInfo {
                            _channel: current_channel,
                            name: if track_name.is_empty() {
                                format!("Kênh {}", current_channel + 1)
                            } else {
                                track_name
                            },
                            program: current_program,
                            note_count: 0,
                        });
                entry.note_count += note_count;
            }
        }
    }

    let mut result_tracks: Vec<TrackInfoWasm> = Vec::new();
    let mut channels: Vec<u8> = channel_map.keys().copied().collect();
    channels.sort_unstable();

    if channels.is_empty() {
        // Fallback 16 channels
        for i in 0..16u8 {
            let is_drum = i == 9;
            let prog = 0;
            let (pan, reverb, chorus) = get_default_track_settings(prog, i);
            result_tracks.push(TrackInfoWasm {
                channel: i,
                name: if is_drum {
                    "Bộ trống (Drums)".to_string()
                } else {
                    format!("Bè Kênh {}", i + 1)
                },
                instrument_name: if is_drum {
                    "Drum Kit".to_string()
                } else {
                    "Acoustic Piano".to_string()
                },
                instrument_number: prog,
                volume: 80,
                is_muted: false,
                is_soloed: false,
                note_count: 1,
                pan,
                reverb_send: reverb,
                chorus_send: chorus,
            });
        }
    } else {
        for chan in channels {
            if let Some(info) = channel_map.get(&chan) {
                let (pan, reverb, chorus) = get_default_track_settings(info.program, chan);
                result_tracks.push(TrackInfoWasm {
                    channel: chan,
                    name: info.name.clone(),
                    instrument_name: format!("Program #{}", info.program),
                    instrument_number: info.program,
                    volume: 80,
                    is_muted: false,
                    is_soloed: false,
                    note_count: info.note_count,
                    pan,
                    reverb_send: reverb,
                    chorus_send: chorus,
                });
            }
        }
    }

    serde_wasm_bindgen::to_value(&result_tracks).unwrap_or(JsValue::NULL)
}

#[derive(Debug, Clone)]
pub(crate) struct TrackDefinition {
    pub(crate) name: &'static str,
    pub(crate) program: u8,
    pub(crate) channel: u8,
}

const SYMPHONIC_TRACKS: [TrackDefinition; 11] = [
    TrackDefinition {
        name: "Violin I (Treble Strings)",
        program: 40,
        channel: 0,
    },
    TrackDefinition {
        name: "Violin II (Treble Strings)",
        program: 40,
        channel: 1,
    },
    TrackDefinition {
        name: "Viola (Alto Strings)",
        program: 41,
        channel: 2,
    },
    TrackDefinition {
        name: "Cello (Bass Strings)",
        program: 42,
        channel: 3,
    },
    TrackDefinition {
        name: "Contrabass (Deep Strings)",
        program: 43,
        channel: 4,
    },
    TrackDefinition {
        name: "Flute (Woodwind)",
        program: 73,
        channel: 5,
    },
    TrackDefinition {
        name: "Oboe (Woodwind)",
        program: 68,
        channel: 6,
    },
    TrackDefinition {
        name: "Clarinet (Woodwind)",
        program: 71,
        channel: 7,
    },
    TrackDefinition {
        name: "French Horn (Brass)",
        program: 60,
        channel: 8,
    },
    TrackDefinition {
        name: "Timpani (Percussion)",
        program: 47,
        channel: 9,
    },
    TrackDefinition {
        name: "Orchestral Harp (Plucked)",
        program: 46,
        channel: 10,
    },
];

const CONCERTO_TRACKS: [TrackDefinition; 9] = [
    TrackDefinition {
        name: "Solo Grand Piano",
        program: 0,
        channel: 0,
    },
    TrackDefinition {
        name: "Violin I (Orchestra)",
        program: 40,
        channel: 1,
    },
    TrackDefinition {
        name: "Violin II (Orchestra)",
        program: 40,
        channel: 2,
    },
    TrackDefinition {
        name: "Viola (Orchestra)",
        program: 41,
        channel: 3,
    },
    TrackDefinition {
        name: "Cello (Orchestra)",
        program: 42,
        channel: 4,
    },
    TrackDefinition {
        name: "Contrabass (Orchestra)",
        program: 43,
        channel: 5,
    },
    TrackDefinition {
        name: "Flute (Orchestra)",
        program: 73,
        channel: 6,
    },
    TrackDefinition {
        name: "French Horn (Orchestra)",
        program: 60,
        channel: 7,
    },
    TrackDefinition {
        name: "Timpani (Orchestra)",
        program: 47,
        channel: 8,
    },
];

pub(crate) struct PreparedNoteEvent {
    pub(crate) channel: u8,
    pub(crate) key: u8,
    pub(crate) start_tick: u32,
    pub(crate) duration_ticks: u32,
    pub(crate) velocity: u8,
}

pub(crate) fn build_midi_file(
    tracks_def: &[TrackDefinition],
    events: Vec<PreparedNoteEvent>,
    bpm: u32,
) -> Vec<u8> {
    let ppq: u16 = 480;
    let mut out = Vec::new();

    // 1. Header chunk (MThd)
    out.extend_from_slice(b"MThd");
    out.extend_from_slice(&6u32.to_be_bytes());
    out.extend_from_slice(&1u16.to_be_bytes()); // Format 1
    out.extend_from_slice(&(tracks_def.len() as u16).to_be_bytes());
    out.extend_from_slice(&ppq.to_be_bytes());

    let tempo_us = 60_000_000u32 / bpm.max(1);

    // Group events by channel
    let mut track_events: Vec<Vec<(u32, u8, u8, u8)>> = vec![Vec::new(); tracks_def.len()]; // (tick, is_on, key, velocity)

    for ev in events {
        let ch_idx = ev.channel as usize;
        if ch_idx < tracks_def.len() {
            track_events[ch_idx].push((ev.start_tick, 1, ev.key, ev.velocity));
            track_events[ch_idx].push((ev.start_tick + ev.duration_ticks, 0, ev.key, 0));
        }
    }

    for (i, def) in tracks_def.iter().enumerate() {
        let mut trk = track_events[i].clone();
        trk.sort_by_key(|e| e.0);

        let mut trk_data = Vec::new();

        // Delta 0: Track Name meta
        write_vlq(&mut trk_data, 0);
        trk_data.push(0xFF);
        trk_data.push(0x03);
        write_vlq(&mut trk_data, def.name.len() as u32);
        trk_data.extend_from_slice(def.name.as_bytes());

        // Delta 0: Set Tempo meta (first track)
        if i == 0 {
            write_vlq(&mut trk_data, 0);
            trk_data.push(0xFF);
            trk_data.push(0x51);
            trk_data.push(0x03);
            trk_data.push(((tempo_us >> 16) & 0xFF) as u8);
            trk_data.push(((tempo_us >> 8) & 0xFF) as u8);
            trk_data.push((tempo_us & 0xFF) as u8);
        }

        // Delta 0: Program Change
        write_vlq(&mut trk_data, 0);
        trk_data.push(0xC0 | (def.channel & 0x0F));
        trk_data.push(def.program);

        let mut last_tick = 0u32;
        for (tick, is_on, key, vel) in trk {
            let delta = tick.saturating_sub(last_tick);
            last_tick = tick;

            write_vlq(&mut trk_data, delta);
            if is_on == 1 {
                trk_data.push(0x90 | (def.channel & 0x0F));
                trk_data.push(key);
                trk_data.push(vel);
            } else {
                trk_data.push(0x80 | (def.channel & 0x0F));
                trk_data.push(key);
                trk_data.push(0);
            }
        }

        // End of Track Meta
        write_vlq(&mut trk_data, 0);
        trk_data.extend_from_slice(&[0xFF, 0x2F, 0x00]);

        // Write MTrk Header
        out.extend_from_slice(b"MTrk");
        out.extend_from_slice(&(trk_data.len() as u32).to_be_bytes());
        out.extend(trk_data);
    }

    out
}

#[wasm_bindgen]
#[must_use]
pub fn generate_symphony_midi_wasm(bytes: &[u8]) -> Vec<u8> {
    let (mut all_notes, bpm) = MidiParserHelper::parse_all_notes(bytes);
    if all_notes.is_empty() {
        return bytes.to_vec();
    }

    all_notes.sort_by(|a, b| {
        a.time
            .partial_cmp(&b.time)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // Note Thinning
    let max_voices_per_window = 8;
    let quantize_window = 0.03;

    let mut thinned_notes = Vec::new();
    let mut window_start = -f64::INFINITY;
    let mut window_notes: Vec<RawNote> = Vec::new();

    let flush_win = |w_notes: &mut Vec<RawNote>, t_notes: &mut Vec<RawNote>| {
        if w_notes.len() <= max_voices_per_window {
            t_notes.append(w_notes);
        } else {
            w_notes.sort_by(|a, b| {
                b.velocity
                    .partial_cmp(&a.velocity)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
            t_notes.extend(w_notes.drain(0..max_voices_per_window));
            w_notes.clear();
        }
    };

    for note in all_notes {
        if note.time - window_start > quantize_window {
            flush_win(&mut window_notes, &mut thinned_notes);
            window_start = note.time;
        }
        window_notes.push(note);
    }
    flush_win(&mut window_notes, &mut thinned_notes);

    thinned_notes.sort_by(|a, b| {
        a.time
            .partial_cmp(&b.time)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let ppq = 480.0;
    let sec_per_tick = 60.0 / (f64::from(bpm) * ppq);

    let mut prepared_events = Vec::new();
    let mut violin_alternator = 0u32;
    let mut last_timpani_time = -5.0f64;

    for note in thinned_notes {
        let m = note.midi;
        let t = note.time;
        let d = note.duration;
        let v = note.velocity;

        let start_tick = (t / sec_per_tick).round() as u32;
        let dur_ticks = ((d / sec_per_tick).max(1.0)).round() as u32;

        let add_note = |events: &mut Vec<PreparedNoteEvent>, ch: u8, key: u8, scale: f32| {
            let vel = ((v * scale * 127.0).clamp(1.0, 127.0)) as u8;
            events.push(PreparedNoteEvent {
                channel: ch,
                key,
                start_tick,
                duration_ticks: dur_ticks,
                velocity: vel,
            });
        };

        if m >= 64 {
            if violin_alternator.is_multiple_of(2) {
                add_note(&mut prepared_events, 0, m, 1.0);

                add_note(&mut prepared_events, 1, m, 0.35);
            } else {
                add_note(&mut prepared_events, 1, m, 0.85);
                add_note(&mut prepared_events, 0, m, 0.4);
            }
            violin_alternator += 1;

            if m >= 72 {
                add_note(&mut prepared_events, 5, m, 0.65);
            }
            if v >= 0.5 {
                add_note(&mut prepared_events, 7, m, 0.4);
            }
            if v >= 0.7 {
                add_note(&mut prepared_events, 8, m, 0.35);
            }
            if d >= 0.3 && v >= 0.5 {
                add_note(&mut prepared_events, 10, m, 0.3);
            }
        } else if (48..64).contains(&m) {
            add_note(&mut prepared_events, 2, m, 0.8);
            if v >= 0.55 {
                add_note(&mut prepared_events, 6, m, 0.55);
            }
            if d >= 0.25 && v >= 0.5 {
                add_note(&mut prepared_events, 8, m, 0.4);
            }
        } else {
            add_note(&mut prepared_events, 3, m, 0.9);
            let cb_midi = if m >= 36 { m - 12 } else { m };
            add_note(&mut prepared_events, 4, cb_midi, 0.65);

            if m < 40 && (t - last_timpani_time) >= 1.5 {
                let timpani_dur_ticks = (((d.min(0.4)) / sec_per_tick).max(1.0)).round() as u32;
                prepared_events.push(PreparedNoteEvent {
                    channel: 9,
                    key: m,
                    start_tick,
                    duration_ticks: timpani_dur_ticks,
                    velocity: ((v * 0.45 * 127.0).clamp(1.0, 127.0)) as u8,
                });
                last_timpani_time = t;
            }
        }
    }

    build_midi_file(&SYMPHONIC_TRACKS, prepared_events, bpm)
}

#[wasm_bindgen]
#[must_use]
pub fn generate_concerto_midi_wasm(bytes: &[u8]) -> Vec<u8> {
    let (mut all_notes, bpm) = MidiParserHelper::parse_all_notes(bytes);
    if all_notes.is_empty() {
        return bytes.to_vec();
    }

    all_notes.sort_by(|a, b| {
        a.time
            .partial_cmp(&b.time)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let ppq = 480.0;
    let sec_per_tick = 60.0 / (f64::from(bpm) * ppq);

    let mut prepared_events = Vec::new();
    let mut last_timpani_time = -5.0f64;

    for note in all_notes {
        let m = note.midi;
        let t = note.time;
        let d = note.duration;
        let v = note.velocity;

        let start_tick = (t / sec_per_tick).round() as u32;
        let dur_ticks = ((d / sec_per_tick).max(1.0)).round() as u32;

        let add_note = |events: &mut Vec<PreparedNoteEvent>, ch: u8, key: u8, scale: f32| {
            let vel = ((v * scale * 127.0).clamp(1.0, 127.0)) as u8;
            events.push(PreparedNoteEvent {
                channel: ch,
                key,
                start_tick,
                duration_ticks: dur_ticks,
                velocity: vel,
            });
        };

        // 1. Solo Grand Piano plays ALL notes
        add_note(&mut prepared_events, 0, m, 1.0);

        // 2. Orchestra accompanies softly
        if m >= 64 {
            add_note(&mut prepared_events, 1, m, 0.45);
            add_note(&mut prepared_events, 2, m, 0.35);
            if m >= 72 {
                add_note(&mut prepared_events, 6, m, 0.4);
            }
            add_note(&mut prepared_events, 7, m, 0.3);
        } else if (48..64).contains(&m) {
            add_note(&mut prepared_events, 3, m, 0.4);
            add_note(&mut prepared_events, 7, m, 0.35);
        } else {
            add_note(&mut prepared_events, 4, m, 0.5);
            let cb_midi = if m >= 36 { m - 12 } else { m };
            add_note(&mut prepared_events, 5, cb_midi, 0.4);

            if m < 40 && (t - last_timpani_time) >= 1.2 {
                let timpani_dur_ticks = (((d.min(0.4)) / sec_per_tick).max(1.0)).round() as u32;
                prepared_events.push(PreparedNoteEvent {
                    channel: 8,
                    key: m,
                    start_tick,
                    duration_ticks: timpani_dur_ticks,
                    velocity: ((v * 0.35 * 127.0).clamp(1.0, 127.0)) as u8,
                });
                last_timpani_time = t;
            }
        }
    }

    build_midi_file(&CONCERTO_TRACKS, prepared_events, bpm)
}
