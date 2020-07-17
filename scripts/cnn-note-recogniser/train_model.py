import argparse
import os
import pathlib
from datetime import datetime

from folkfriend.cnn.cnn_png_dataset import CNNPngDataset
from folkfriend.cnn.model import assemble_model
from tensorflow import keras


def main(args):
    train_data, val_data = CNNPngDataset(args.dataset)
    model = assemble_model()

    model.compile(optimizer=keras.optimizers.Adam(args.learning_rate),
                  loss=keras.losses.CategoricalCrossentropy())
    model.summary()

    if args.restore:
        # TODO reload entire model not just weights
        model.load_weights(args.weights, by_name=True, skip_mismatch=True)

    model_dir = os.path.join('models', args.name)
    log_dir = os.path.join('logs', args.name)
    callbacks = [keras.callbacks.ModelCheckpoint(model_dir),
                 keras.callbacks.TensorBoard(log_dir=log_dir,
                                             profile_batch=0)]
    model.fit(train_data,
              epochs=args.epochs,
              initial_epoch=0,  # TODO
              callbacks=callbacks,
              validation_data=val_data)


if __name__ == '__main__':
    path_timestamp = datetime.now().strftime('%H%M%S-%d%m%Y')
    parser = argparse.ArgumentParser()
    parser.add_argument('-d', '--dataset',
                        default=os.path.join(str(pathlib.Path.home()),
                                             'datasets',
                                             'folkfriend'),
                        help='Path to dataset directory')
    parser.add_argument('-n', '--name',
                        'A label to use for this training run. Models will be'
                        'saved to models/<name> and logs to logs/<name>. '
                        'Defaults to a timestamp of the current time.',
                        default=datetime.now().strftime('%d-%b-%Y-%H%M%S'))
    parser.add_argument('-e', '--epochs', default=5, type=int)
    parser.add_argument('-bs', '--batch-size', default=512, type=int)
    parser.add_argument('-lr', '--learning-rate', default=0.001, type=float)
    parser.add_argument('-w', '--weights',
                        help='Restore model using previously trained weights')
    main(parser.parse_args())
