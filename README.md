# FolkFriend
Scripts and Web Application for folk music tune transcription and recognition.

# Dependencies
- `pyenv`
- `abcmidi` (if building data indices)

# Structure of Repository

| Directory | Description |
| ---       | ---         |
| `app/`| bits and bobs relating to the javascript app |
| `scripts/`| Python scripts for backend things
| `utils/`  | Contains the `folkfriend` module; python implementation of all the functionality that runs client-side in the app.

# Using Rust

1. Install Rust
2. From the `rust/` directory of this repository, run `cargo build --release` to compile the `folkfriend` executable on your machine.
3. Add the `folkfriend` executable to your system path, for example using `sudo cp folkfriend /usr/local/bin/`.

# Using Python

To use the python scripts and the python module `folkfriend` located in the `utils` directory, please follow the steps below.

1. Ensure you have installed pyenv
2. Ensure you have installed the correct python version by running `pyenv install`
3. Verify using `which python` and `which pip` that you are using your pyenv and not your system wide python installation any other virtual environment. The output should look something like `/home/tom/.pyenv/shims/python`.
4. Install the `virtualenv` module to your pyenv using `pip install virtualenv`
5. Create a local virtual environment in the directory `venv` by running `python -m virtualenv venv`
6. Source the env script by running `source env.sh` which does three things:
    * Activates the virtual environment you made in the `venv` directory
    * Installs the required modules from `requirements.txt` to your virtual environment.
    * Prepends the absolute path of the directory `utils/` to your `PYTHONPATH` environment variable, which allows you to import the `folkfriend` module inside the `utils/` directory, anytime that you have this virtual environment activated.
