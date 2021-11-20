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

1. Install Rust
2. From the `rust/` directory of this repository, run `cargo build --release` to compile the `folkfriend` executable on your machine.
3. Add the `folkfriend` executable to your system path, for example by including a directory containing `folkfriend` to your path environment variable or by using `sudo cp folkfriend /usr/local/bin/`.
