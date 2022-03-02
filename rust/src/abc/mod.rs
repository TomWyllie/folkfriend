mod key_types;
mod key_converter;
use crate::decode::types::Contour;

pub fn contour_to_abc(contour: &Contour) -> String {
    key_converter::contour_to_abc(&contour)
}