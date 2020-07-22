import argparse
import glob
import json
import os
import pathlib
from datetime import datetime

from tensorflow import keras

from folkfriend.rnn.callbacks import TrainingConfigWriter
from folkfriend.rnn.dataset import DatasetBuilder
from folkfriend.rnn.losses import CTCLoss
from folkfriend.rnn.metrics import WordError
from folkfriend.rnn.model import build_model
from folkfriend import ff_config

# import tensorflow as tf
# gpus = tf.config.experimental.list_physical_devices('GPU')
# tf.config.experimental.set_virtual_device_configuration(gpus[0], [
#     tf.config.experimental.VirtualDeviceConfiguration(memory_limit=1024)])

parser = argparse.ArgumentParser()
parser.add_argument('--dir',
                    default=os.path.join(str(pathlib.Path.home()),
                                         'datasets/folkfriend'),
                    help='Directory to contain the dataset files in')
parser.add_argument('-w', '--img_width', type=int, default=ff_config.SPEC_NUM_FRAMES,
                    help='Image width, this parameter will affect the output '
                         'shape of the model, default is 100, so this model '
                         'can only predict up to 24 characters.')
parser.add_argument('-b', '--batch_size', type=int, default=256,
                    help='Batch size.')
parser.add_argument('-lr', '--learning_rate', type=float, default=0.001,
                    help='Learning rate.')
parser.add_argument('-e', '--epochs', type=int, default=30,
                    help='Num of epochs to train.')
parser.add_argument('--img_channels', type=int, default=1,
                    help='0: Use the number of channels in the image, '
                         '1: Grayscale image, 3: RGB image')
parser.add_argument('--ignore_case', action='store_true',
                    help='Whether ignore case.(default false)')
parser.add_argument('--restore', type=str,
                    help='The model for restore, even if the number of '
                         'characters is different')
parser.add_argument('-ar', '--auto-resume', action='store_true')
args = parser.parse_args()

val_path = os.path.join(args.dir, 'val.txt')
table_path = os.path.join(args.dir, 'table.txt')
train_path = os.path.join(args.dir, 'train.txt')


localtime = datetime.now().strftime('%d-%b-%Y-%H%M%S')
initial_epoch = 0

config_path = TrainingConfigWriter.get_config_path()
if args.auto_resume and os.path.exists(config_path):
    with open(config_path, 'r') as f:
        previous_config = json.load(f)
    localtime = previous_config['localtime']
    initial_epoch = previous_config['epoch'] + 1

dataset_builder = DatasetBuilder(table_path, args.img_width,
                                 args.img_channels)
train_ds, train_size = dataset_builder.build([train_path], True,
                                             args.batch_size)
print('Num of training samples: {}'.format(train_size))
saved_model_prefix = '{epoch:03d}_{word_edit_distance:.4f}'

val_ds, val_size = dataset_builder.build([val_path], False,
                                         args.batch_size)
print('Num of val samples: {}'.format(val_size))
saved_model_prefix = saved_model_prefix + '_{val_word_edit_distance:.4f}'

saved_model_path = ('saved_models/{}/'.format(localtime) +
                    saved_model_prefix + '.h5')

model = build_model()
model.compile(optimizer=keras.optimizers.Adam(args.learning_rate),
              loss=CTCLoss(), metrics=[WordError()])

if args.auto_resume and os.path.exists(config_path):
    # TODO improve path handling
    reload_path_glob = os.path.join('saved_models', localtime, '{:0>3}*'.format(initial_epoch))
    reload_path = glob.glob(reload_path_glob)[0]
    model.load_weights(reload_path)
    print('Training resume at {}'.format(localtime))
else:
    model.summary()
    os.makedirs('saved_models/{}'.format(localtime))
    print('Training start at {}'.format(localtime))

if args.restore:
    model.load_weights(args.restore, by_name=True, skip_mismatch=True)

callbacks = [TrainingConfigWriter(localtime),
             keras.callbacks.ModelCheckpoint(saved_model_path),
             keras.callbacks.TensorBoard(log_dir='logs/{}'.format(localtime),
                                         profile_batch=0)]
model.fit(train_ds,
          epochs=args.epochs,
          initial_epoch=initial_epoch,
          callbacks=callbacks,
          validation_data=val_ds)
