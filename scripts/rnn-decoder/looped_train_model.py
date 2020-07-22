import subprocess
import sys
from folkfriend import ff_config


def main():
    # If it fails 100 times something is really badly wrong.
    for _ in range(100):
        subprocess.run(['python', 'train_model.py',
                        '--dir', ff_config.DEFAULT_DS_DIR,
                        '-ar',
                        '-w', f'{ff_config.SPEC_NUM_FRAMES}',
                        '-b', '256',
                        '-e', '1000',
                        '-lr', '0.001'
                        ], stdout=sys.stdout, bufsize=1)


if __name__ == '__main__':
    main()
