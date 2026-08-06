pub mod audio_dsp;
pub mod midi_processor;
pub mod xml_parser;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn init_synthscore_wasm() -> bool {
    // Initialization flag/hook for WASM module
    true
}
