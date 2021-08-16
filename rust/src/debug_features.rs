use crate::folkfriend::ff_config;
use crate::folkfriend::sig_proc::feature_extractor;

use image;

pub fn save_features_as_img(fe: &feature_extractor::FeatureExtractor, path: &String) {
    let imgx = fe.features.len() as u32;
    let imgy = ff_config::MIDI_NUM;
    let mut imgbuf = image::ImageBuffer::new(imgx, imgy);

    let max = fe.features.iter().flatten().max_by(|a, b| a.partial_cmp(b).expect("NaN")).unwrap();
    

    // Iterate over the coordinates and pixels of the image
    for (x, y, pixel) in imgbuf.enumerate_pixels_mut() {
        let grey = (255. * fe.features[x as usize][(imgy - y - 1) as usize] / max) as u8;
        *pixel = image::Luma([grey]);
    }

    // Save the image
    imgbuf.save(path).unwrap();
}
