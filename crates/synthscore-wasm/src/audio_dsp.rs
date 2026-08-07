use byteorder::{LittleEndian, WriteBytesExt};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[must_use]
pub fn encode_wav_wasm(
    samples_l: &[f32],
    samples_r: &[f32],
    sample_rate: u32,
    bit_depth: u16,
) -> Vec<u8> {
    let num_channels = if samples_r.is_empty() { 1u16 } else { 2u16 };
    let num_samples = samples_l.len();
    let format_tag = if bit_depth == 32 { 3u16 } else { 1u16 }; // 1 = PCM, 3 = IEEE Float
    let bytes_per_sample = match bit_depth {
        24 => 3u16,
        32 => 4u16,
        _ => 2u16, // Mặc định 16-bit
    };
    let actual_bit_depth = bytes_per_sample * 8;
    let block_align = num_channels * bytes_per_sample;
    let byte_rate = sample_rate * u32::from(block_align);
    let data_size = num_samples as u32 * u32::from(block_align);
    let file_size = 44 + data_size;

    let mut buf = Vec::with_capacity(file_size as usize);

    // RIFF Header
    buf.extend_from_slice(b"RIFF");
    let _ = buf.write_u32::<LittleEndian>(file_size - 8);
    buf.extend_from_slice(b"WAVE");

    // fmt chunk
    buf.extend_from_slice(b"fmt ");
    let _ = buf.write_u32::<LittleEndian>(16); // Chunk size
    let _ = buf.write_u16::<LittleEndian>(format_tag); // PCM hoặc IEEE Float
    let _ = buf.write_u16::<LittleEndian>(num_channels);
    let _ = buf.write_u32::<LittleEndian>(sample_rate);
    let _ = buf.write_u32::<LittleEndian>(byte_rate);
    let _ = buf.write_u16::<LittleEndian>(block_align);
    let _ = buf.write_u16::<LittleEndian>(actual_bit_depth);

    // data chunk
    buf.extend_from_slice(b"data");
    let _ = buf.write_u32::<LittleEndian>(data_size);

    for i in 0..num_samples {
        let sample_l = samples_l[i].clamp(-1.0, 1.0);
        match actual_bit_depth {
            24 => {
                let val_l = (sample_l * 8388607.0) as i32;
                buf.push((val_l & 0xFF) as u8);
                buf.push(((val_l >> 8) & 0xFF) as u8);
                buf.push(((val_l >> 16) & 0xFF) as u8);
            }
            32 => {
                let _ = buf.write_f32::<LittleEndian>(sample_l);
            }
            _ => {
                let val_l = (sample_l * 32767.0) as i16;
                let _ = buf.write_i16::<LittleEndian>(val_l);
            }
        }

        if num_channels == 2 && i < samples_r.len() {
            let sample_r = samples_r[i].clamp(-1.0, 1.0);
            match actual_bit_depth {
                24 => {
                    let val_r = (sample_r * 8388607.0) as i32;
                    buf.push((val_r & 0xFF) as u8);
                    buf.push(((val_r >> 8) & 0xFF) as u8);
                    buf.push(((val_r >> 16) & 0xFF) as u8);
                }
                32 => {
                    let _ = buf.write_f32::<LittleEndian>(sample_r);
                }
                _ => {
                    let val_r = (sample_r * 32767.0) as i16;
                    let _ = buf.write_i16::<LittleEndian>(val_r);
                }
            }
        }
    }

    buf
}

#[wasm_bindgen]
#[must_use]
pub fn encode_dsd_dsf_wasm(
    samples_l: &[f32],
    samples_r: &[f32],
    sample_rate: u32,
    oversample_factor: u32,
) -> Vec<u8> {
    let num_channels = if samples_r.is_empty() { 1u32 } else { 2u32 };
    let original_length = samples_l.len();
    let factor = if oversample_factor == 0 {
        64
    } else {
        oversample_factor
    };

    let dsd_sample_rate = sample_rate * factor;
    let total_dsd_samples = original_length * factor as usize;

    let block_size = 4096;
    let block_bits = block_size * 8;
    let num_blocks = total_dsd_samples.div_ceil(block_bits);

    let padded_dsd_samples = num_blocks * block_bits;

    let dsd_data_size = (num_blocks * block_size * num_channels as usize) as u64;
    let file_size: u64 = 28 + 64 + 12 + dsd_data_size;

    let mut buf = Vec::with_capacity(file_size as usize);

    // 1. DSD Chunk (28 bytes)
    buf.extend_from_slice(b"DSD ");
    let _ = buf.write_u32::<LittleEndian>(28);
    let _ = buf.write_u32::<LittleEndian>(0);
    let _ = buf.write_u64::<LittleEndian>(file_size);
    let _ = buf.write_u64::<LittleEndian>(0);

    // 2. fmt Chunk (64 bytes)
    buf.extend_from_slice(b"fmt ");
    let _ = buf.write_u32::<LittleEndian>(52);
    let _ = buf.write_u32::<LittleEndian>(0);
    let _ = buf.write_u32::<LittleEndian>(1); // format version
    let _ = buf.write_u32::<LittleEndian>(0); // format ID
    let _ = buf.write_u32::<LittleEndian>(if num_channels == 1 { 1 } else { 2 });
    let _ = buf.write_u32::<LittleEndian>(num_channels);
    let _ = buf.write_u32::<LittleEndian>(dsd_sample_rate);
    let _ = buf.write_u32::<LittleEndian>(1); // bits per sample
    let _ = buf.write_u64::<LittleEndian>(padded_dsd_samples as u64);
    let _ = buf.write_u32::<LittleEndian>(block_size as u32);
    let _ = buf.write_u32::<LittleEndian>(0);
    let _ = buf.write_u32::<LittleEndian>(0);
    let _ = buf.write_u32::<LittleEndian>(0);
    let _ = buf.write_u32::<LittleEndian>(0);

    // 3. data Chunk (12 bytes header + dsd_data_size)
    buf.extend_from_slice(b"data");
    let data_chunk_size = 12 + dsd_data_size;
    let _ = buf.write_u64::<LittleEndian>(data_chunk_size);

    // 4. Modulate PCM to DSD using 1st order Delta-Sigma Noise Shaping
    let channels_data = [samples_l, samples_r];
    let mut integrators = [0.0f32; 2];
    let mut outputs = [0.0f32; 2];

    let inv_factor = 1.0f32 / (factor as f32);
    let mut block_buffer = vec![0u8; block_size];

    for b in 0..num_blocks {
        for c in 0..num_channels as usize {
            let channel_pcm = channels_data[c];
            block_buffer.fill(0);
            let max_idx = channel_pcm.len().saturating_sub(1);
            let mut integ = integrators[c];
            let mut out_val = outputs[c];

            for bit_idx in 0..block_bits {
                let dsd_sample_idx = b * block_bits + bit_idx;
                let x = if dsd_sample_idx < total_dsd_samples && !channel_pcm.is_empty() {
                    let pcm_idx_float = (dsd_sample_idx as f32) * inv_factor;
                    let idx_lower = (pcm_idx_float as usize).min(max_idx);
                    let idx_upper = (idx_lower + 1).min(max_idx);
                    let frac = pcm_idx_float - (idx_lower as f32);

                    let pcm_val_lower = channel_pcm[idx_lower];
                    let pcm_val_upper = channel_pcm[idx_upper];
                    pcm_val_lower + frac * (pcm_val_upper - pcm_val_lower)
                } else {
                    0.0f32
                };

                integ += x - out_val;
                if integ >= 0.0 {
                    out_val = 1.0;
                    let byte_offset = bit_idx >> 3;
                    let bit_offset = bit_idx & 7;
                    block_buffer[byte_offset] |= 1 << bit_offset;
                } else {
                    out_val = -1.0;
                }
            }

            integrators[c] = integ;
            outputs[c] = out_val;
            buf.extend_from_slice(&block_buffer);
        }
    }

    buf
}
