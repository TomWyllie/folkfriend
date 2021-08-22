use crate::folkfriend::ff_config;
use crate::folkfriend::feature::interpolate::InterpInd;

pub type Frame = [f32; ff_config::MIDI_NUM as usize];
pub type Features = Vec<Frame>;
pub type InterpInds = Vec<InterpInd>;
