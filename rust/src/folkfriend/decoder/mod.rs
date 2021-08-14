pub mod pitch_model;

pub struct Decoder {
    pitch_model: pitch_model::PitchModel
}

impl Decoder {
    pub fn new() -> Decoder {
        Decoder {
            pitch_model: pitch_model::PitchModel::new()
        }
    }
}