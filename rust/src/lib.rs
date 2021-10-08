pub mod abc;
pub mod decode;
pub mod feature;
pub mod ff_config;
pub mod index;
pub mod query;

use std::slice;
use std::convert::TryInto;
use wasm_bindgen::prelude::*;
use serde_json::json;

pub struct FolkFriend {
    query_engine: query::QueryEngine,
    feature_extractor: feature::feature_extractor::FeatureExtractor,
    feature_decoder: decode::FeatureDecoder,
    abc_processor: abc::AbcProcessor,
}

impl FolkFriend {
    pub fn new() -> FolkFriend {
        FolkFriend {
            query_engine: query::QueryEngine::new(),
            feature_extractor: feature::feature_extractor::FeatureExtractor::new(
                ff_config::SAMPLE_RATE_DEFAULT,
            ),
            feature_decoder: decode::FeatureDecoder::new(),
            abc_processor: abc::AbcProcessor::new(),
        }
    }

    pub fn load_index_from_json_string(&mut self, json_string: String) {
        let tune_index = index::tune_index_from_string(&json_string);
        self.query_engine.use_tune_index(tune_index);
    }

    pub fn set_sample_rate(&mut self, sample_rate: u32) {
        if self.feature_extractor.sample_rate != sample_rate {
            self.feature_extractor = feature::feature_extractor::FeatureExtractor::new(sample_rate);
        }
    }

    pub fn feed_entire_pcm_signal(&mut self, pcm_signal: Vec<f32>) {
        self.feature_extractor.feed_signal(pcm_signal);
    }

    pub fn feed_single_pcm_window(&mut self, pcm_window: [f32; ff_config::SPEC_WINDOW_SIZE]) {
        self.feature_extractor.feed_window(pcm_window);
    }

    pub fn flush_pcm_buffer(&mut self) {
        self.feature_extractor.flush();
    }

    pub fn transcribe_pcm_buffer(&mut self) -> decode::types::ContourString {
        let contour = self
            .feature_decoder
            .decode(&mut self.feature_extractor.features);
        self.feature_extractor.flush();
        return contour;
    }

    pub fn run_transcription_query(
        &self,
        contour: &decode::types::ContourString,
    ) -> Result<query::TranscriptionQueryResults, query::QueryError> {
        self.query_engine.run_contour_query(contour)
    }

    pub fn run_name_query(
        &self,
        query: &String,
    ) -> Result<query::NameQueryResults, query::QueryError> {
        self.query_engine.run_name_query(query)
    }

    pub fn contour_to_abc(&self, contour_string: &decode::types::ContourString) -> String {
        let contour: decode::types::Contour = decode::types::from_contour_string(contour_string);
        self.abc_processor.contour_to_abc(&contour)
    }
}


// Define a WASM-safe version of this FolkFriend class. The key point is that
//  all function signatures will have simple types that can pass between WASM
//  and JS. e.g. search results are encoded as a JSON String rather than a
//  vector of structs. The latter would be better, but WASM/JS can't hadnle
//  this yet.

#[wasm_bindgen]
pub struct FolkFriendWASM {
    ff: FolkFriend
}

#[wasm_bindgen]
impl FolkFriendWASM {
    #[wasm_bindgen(constructor)]
    pub fn new() -> FolkFriendWASM {
        FolkFriendWASM {
            ff: FolkFriend::new()
        }
    }

    pub fn load_index_from_json_string(&mut self, json_string: &str) {
        self.ff.load_index_from_json_string(json_string.to_string());
    }

    pub fn set_sample_rate(&mut self, sample_rate: u32) {
        self.ff.set_sample_rate(sample_rate);
    }

    pub fn feed_entire_pcm_signal(&mut self) {
        panic!("Cannot feed entire PCM signal from WebAssembly!");
    }

    pub fn alloc_single_pcm_window(&mut self) -> *mut f32 {
        // This function is not required in the non-WASM version of FolkFriend.
        //  This is required for passing Float32Arrays (audio data) from
        //   javascript into rust.
        let mut buf: [f32; ff_config::SPEC_WINDOW_SIZE] = [0.; ff_config::SPEC_WINDOW_SIZE];
        
        // This pointer will be given to JavaScript so that it can write 
        //  directly into WebAssembly's memory
        let ptr = buf.as_mut_ptr();
        
        // Take ownership of this memory block to prevent destruction
        // See https://radu-matei.com/blog/practical-guide-to-wasm-memory/
        std::mem::forget(buf);

        return ptr;
    }

    pub fn feed_single_pcm_window(&mut self, ptr: *mut f32) {
        let pcm_window = unsafe { slice::from_raw_parts(ptr, ff_config::SPEC_WINDOW_SIZE) };
        self.ff.feed_single_pcm_window(pcm_window.try_into().unwrap());
    }

    pub fn flush_pcm_buffer(&mut self) {
        self.ff.flush_pcm_buffer();
    }

    pub fn transcribe_pcm_buffer(&mut self) -> String {
        self.ff.transcribe_pcm_buffer()
    }

    pub fn run_transcription_query(&self, contour: &str) -> String {
        // TODO proper error propagation in JSON back to javascript
        let result = self.ff.run_transcription_query(&contour.to_string());
        
        if let Ok(query_result) = result {
            return json!(query_result).to_string();
        } else {
            return "{
                \"error\": \"transcription query error\"
            }".to_string();
        }
    }
    
    pub fn run_name_query(&self, query: &str) -> String {
        // TODO proper error propagation in JSON back to javascriptx
        let result = self.ff.run_name_query(&query.to_string());
        
        if let Ok(query_result) = result {
            return json!(query_result).to_string();
        } else {
            return "{
                \"error\": \"name query error\"
            }".to_string();
        }
    }
    
    pub fn contour_to_abc(&self, contour: &str) -> String {
        self.ff.contour_to_abc(&contour.to_string())
    }
}