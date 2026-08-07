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
pub mod xml_parser;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[must_use]
pub fn init_synthscore_wasm() -> bool {
    // Initialization flag/hook for WASM module
    true
}
