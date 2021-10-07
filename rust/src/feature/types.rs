use crate::ff_config;
use crate::feature::interpolate::InterpInd;

pub type Frame = [f32; ff_config::MIDI_NUM as usize];
pub type Features = Vec<Frame>;
pub type InterpInds = Vec<InterpInd>;
pub type Window = [f32; ff_config::SPEC_WINDOW_SIZE];