pub mod decode;
pub mod ff_config;
pub mod index;
pub mod query;
pub mod feature;

pub struct FolkFriend {
    pub query_engine: query::QueryEngine
}

impl FolkFriend {
    pub fn new() -> FolkFriend {
        FolkFriend {
            query_engine: query::QueryEngine::new()
        }
    }

    pub fn load_index_from_json_string(mut self: Self, json_string: String) -> FolkFriend {
        let tune_index = index::tune_index_from_string(&json_string);
        self.query_engine = self.query_engine.use_tune_index(tune_index);
        return self;
    }

    pub fn run_transcription_query(self: &Self, query: &String) -> Result<query::TranscriptionQueryResults, query::QueryError> {
        self.query_engine.run_transcription_query(query)
    }
    
    pub fn run_name_query(self: &Self, query: &String) -> Result<query::NameQueryResults, query::QueryError> {
        self.query_engine.run_name_query(query)
    }
}

// TODO single exposed interface

// methods
//  x load_index_from_json_string
//  - set_sample_rate
//  - feed_entire_pcm_signal
//  - feed_single_pcm_window
//  - flush_pcm_buffer() -> ()
//  - transcribe_pcm_buffer() -> Transcription 
//  x query_by_transcription(Transcription) -> QueryResults
//  x query_by_name(String) -> QueryResults

