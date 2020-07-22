import subprocess
import sys
from folkfriend import ff_config


def main():
    # If it fails 100 times something is really badly wrong.
    for _ in range(100):
        subprocess.run(['python', 'train.py',
                        '--dir', '/home/tom/datasets/folkfriend/',
                        # '--dir', '/home/tom/datasets/rnn-dummy/',
                        '-ar',
                        '-w', f'{ff_config.SPEC_NUM_FRAMES}',
                        '-b', '256',
                        '-e', '1000',
                        # '-lr', '0.001'
                        '-lr', '0.0002'
                        # '-lr', '0.00001'
                        ], stdout=sys.stdout, bufsize=1)

        # Folkfriend 100k learning rate schedule for 55x2 bi-LSTM
        #   epochs 1 - 15:  0.001
        #   epochs 16 - 50 :  0.0002
        #   Best result 6.688% error on Validation set

        # Folkfriend 100k learning rate schedule for 64x1 bi-LSTM
        #   epochs 1 - 34:  0.001
        #   epochs 35 - 75:  0.0001
        #   Best result 6.675% error on Validation set

        # If it finished training successfully then the config file will have been removed
        # if not os.path.exists(TrainingConfigWriter.get_config_path()):
        #     break


if __name__ == '__main__':
    main()
