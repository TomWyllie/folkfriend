# FolkFriend
Scripts and Web Application for folk music tune transcription and recognition.

This is the Github repository for the FolkFriend app, for advanced users and developers of the app. If you are looking to simply use the web version of the app please instead go to [folkfriend.app](https://folkfriend.app). 

# Dependencies
- `rust` (for compiling the folkfriend library from source to run natively)
- `python 3.x` (for running some misc scripts, for example evaluating datasets)
- `wasm-pack` (for compiling the folkfriend library from source into WebAssembly)
- `Vue.js v2.x` (for frontend development)

I shall soon add some precompiled executables for windows + linux so compiling from source is not necessary to use the command line version of the library.

# Structure of Repository

| Directory | Description |
| ---       | ---         |
| `app/`| Source code and build scripts for the PWA hosted at [folkfriend.app](https://folkfriend.app) |
| `resources/`| Miscellaneous static assets |
| `rust/`| FolkFriend library source code (in rust) |
| `utils/`  | Contains the `folkfriend` module; python implementation of all the functionality that runs client-side in the app.

Note that if you are unfamiliar with rust, you can find implementations of all the key parts of FolkFriend in Python 3 in the commit history of this repository (I originally wrote FolkFriend in Python and learned rust as I went about translating into a WASM friendly language). The Python code is unmaintained and may be out of date.

# Using Rust

1. [Install Rust](https://www.rust-lang.org/tools/install).
2. `cd rust/`
3. Run `cargo run` to download and compile dependencies, and to run FolkFriend. To see help command line options, `cargo run -- --help`
4. Optional: from the `rust/` directory of this repository, run `cargo build --release` to compile the `folkfriend` executable on your machine. Then add the `folkfriend` executable to your system path, for example by including the `rust/target/release` directory containing the `folkfriend` executable to your path environment variable or by using `sudo cp rust/target/release/folkfriend /usr/local/bin/`. Now you can use `folkfriend` as a command from your CLI.

# Example usage
#### Transcribing a tune to ABC 
`cargo run -- transcribe wavs/soup_dragon.wav`
#### Output
```
=== Transcription for file "wavs/soup_dragon.wav" ===
Midi sequence: "CEExxvxCEECACCCCACEECACEExxvxCEECACCCEECAxv"

K:Edor
ef2B2A Bef2e |de4de f2ede |f2B2AB ef2ed |e3f2ed BA |

FolkFriend command finished in 56.96ms
```

You may want to add `--release` after `cargo run` to build an optimised binary which compiles slower but is around 10x faster.
You can also run the commands over many files by passing in a CSV file. 

#### Transcribing a tune, and searching the tune index
`cargo run -- query wavs/soup_dragon.wav`
#### Output
```
=== Query for file "wavs/soup_dragon.wav" ===
"10785"	"soup dragon, the"	0.872093
"414"	"seamus cooley's"	0.5697674
"9477"	"gan ainm"	0.53488374
"16022"	"jig for jules"	0.5232558
"23096"	"prince's strand"	0.5
"1902"	"muireann's"	0.5
"19744"	"sue morley's"	0.5
"10420"	"sailor and the maid, the"	0.5
"1317"	"daniel of the sun"	0.4883721
"18027"	"oriental, the"	0.4883721
FolkFriend command finished in 208.24ms
```

This command downloads the tune index to `~/.folkfriend/` on your local machine. The numbers on the left are the IDs from [thesession.org](thesession.org), which is currently the only data source FolkFriend uses.

# TODO
`cargo test` doesn't run any tests because I didn't know how good an idea unit tests were when I built this. When I get around to updating & revamping everything I'll add in lots :)
