use crate::folkfriend::ff_config;
use crate::folkfriend::sig_proc::spectrogram::Features;

use image;

pub fn save_features_as_img(features: &Features, path: &String) {
    let imgx = features.len() as u32;
    let imgy = ff_config::MIDI_NUM;
    let mut imgbuf = image::ImageBuffer::new(imgx, imgy);

    let max = features.iter().flatten().max_by(|a, b| a.partial_cmp(b).expect("NaN")).unwrap();

    // Iterate over the coordinates and pixels of the image
    for (x, y, pixel) in imgbuf.enumerate_pixels_mut() {
        let grey = (255. * features[x as usize][(imgy - y - 1) as usize] / max) as u8;
        *pixel = image::Luma([grey]);
    }

    // Save the image
    imgbuf.save(path).unwrap();
}

pub fn save_contour_as_img(contour: &Vec<u32>, path: &String) {
    let imgx = contour.len() as u32;
    let imgy = ff_config::MIDI_NUM;
    let mut imgbuf = image::ImageBuffer::new(imgx, imgy);

    for (x, pitch) in contour.iter().enumerate() {
        let y = imgy - 1 - (*pitch - ff_config::MIDI_LOW);
        imgbuf.put_pixel(x as u32, y, image::Luma([255 as u8]));
    }

    // Save the image
    imgbuf.save(path).unwrap();
}

// pub fn expand_contour_to_length(contour: Contour, length: usize) {
// 
// }
