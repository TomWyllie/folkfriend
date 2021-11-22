use crate::ff_config;

use crate::feature::types::Features;

pub trait Normalisable {
    fn normalise(&mut self, energy_by_frame: &Vec<f32>);
    fn energy_by_frame(&self) -> Vec<f32>;
}

impl Normalisable for Features {
    fn energy_by_frame(&self) -> Vec<f32> {
        let mut energy_by_frame: Vec<f32> = Vec::new();
        for i in 0..self.len() {
            let mut cum_tot = 0.;
            for j in 0..ff_config::MIDI_NUM {
                cum_tot += &self[i][j as usize];
            }
            energy_by_frame.push(cum_tot);
        }
        return energy_by_frame;
    }

    fn normalise(&mut self, energy_by_frame: &Vec<f32>) {
        // Trims silent edges and normalises energy to have on average 
        //  1 AU per frame.
        
        // println!("{:#?}", energy_by_frame);
        // println!("{:#?}", energy_by_frame.len());

        // let loudest_frame = energy_by_frame
        //         .iter()
        //         .max_by(|a, b| a.partial_cmp(b).expect("NaN energy detected")).expect("Empty frame");
        // let silence_threshold = ff_config::SILENCE_TRIM_THRESHOLD * loudest_frame;

        // let lo = energy_by_frame.iter().position(|energy| energy > &silence_threshold);
        // let hi = energy_by_frame.iter().rev().position(|energy| energy > &silence_threshold);

        // if lo == None {
        //     // Then all features were zero. No features found so return empty.
        //     self.splice(0.., []);
        //     return;
        // }

        // hi is none if and only if lo is none so having checked for lo we can
        //  safely unwrap hi.
        // let lo = lo.unwrap();
        // let hi = energy_by_frame.len() - hi.unwrap();   // Account for iter().rev()

        // Trim silence
        // self.splice(hi.., []);
        // self.splice(..lo, []);

        let total_energy: f32 = energy_by_frame.iter().sum();
        let norm_const = self.len() as f32 / total_energy;
        for i in 0..self.len() {
            for j in 0..ff_config::MIDI_NUM {
                self[i][j as usize] *= norm_const;
            }
        }

        // let energy_by_frame = self.energy_by_frame();
        // println!("{:#?}", energy_by_frame);
        // println!("{:#?}", energy_by_frame.len());

    }
}
