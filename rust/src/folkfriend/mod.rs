pub mod abc;
pub mod decode;
pub mod feature;
pub mod ff_config;
pub mod index;
pub mod query;

pub struct FolkFriend {
    pub query_engine: query::QueryEngine,
    pub feature_extractor: feature::feature_extractor::FeatureExtractor,
    pub feature_decoder: decode::FeatureDecoder,
    pub abc_processor: abc::AbcProcessor,
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

    pub fn transcribe_pcm_buffer(&mut self) -> decode::types::Contour {
        let contour = self
            .feature_decoder
            .decode(&mut self.feature_extractor.features);
        self.feature_extractor.flush();
        return contour;
    }

    pub fn run_transcription_query(
        self: &Self,
        contour: &decode::types::Contour,
    ) -> Result<query::TranscriptionQueryResults, query::QueryError> {
        self.query_engine.run_contour_query(contour)
    }

    pub fn run_name_query(
        self: &Self,
        query: &String,
    ) -> Result<query::NameQueryResults, query::QueryError> {
        self.query_engine.run_name_query(query)
    }

    pub fn contour_to_abc(&self, contour: &decode::types::Contour) -> String {
        self.abc_processor.contour_to_abc(contour)
    }
}

// TODO single exposed interface

// methods
//  x constructor
//  x load_index_from_json_string
//  x set_sample_rate
//  x feed_entire_pcm_signal
//  x feed_single_pcm_window
//  x flush_pcm_buffer() -> ()
//  x transcribe_pcm_buffer() -> Transcription
//  x query_by_transcription(Transcription) -> QueryResults
//  x query_by_name(String) -> QueryResults
//  x contour_to_abc(Contour) -> String
