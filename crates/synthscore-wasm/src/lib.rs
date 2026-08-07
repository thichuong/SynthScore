#![deny(clippy::all)]
#![allow(
    clippy::module_name_repetitions,
    clippy::cast_possible_truncation,
    clippy::cast_precision_loss,
    clippy::cast_sign_loss,
    clippy::too_many_lines,
    clippy::cognitive_complexity,
    clippy::similar_names,
    clippy::unreadable_literal,
    clippy::missing_const_for_fn
)]

pub mod audio_dsp;
pub mod midi_processor;
pub mod mxl_parser;
pub mod xml_parser;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[must_use]
pub fn init_synthscore_wasm() -> bool {
    // Initialization flag/hook for WASM module
    true
}

#[wasm_bindgen]
#[must_use]
pub fn parse_mxl_to_xml_wasm(mxl_bytes: &[u8]) -> String {
    mxl_parser::parse_mxl_bytes(mxl_bytes).unwrap_or_default()
}

#[wasm_bindgen]
#[must_use]
pub fn parse_mxl_to_midi_wasm(mxl_bytes: &[u8]) -> Vec<u8> {
    mxl_parser::parse_mxl_bytes(mxl_bytes).map_or_else(
        |_| Vec::new(),
        |xml_text| xml_parser::parse_musicxml_to_midi_wasm(&xml_text),
    )
}
