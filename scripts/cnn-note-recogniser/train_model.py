import argparse
import os
import pathlib
from datetime import datetime

from folkfriend.cnn.cnn_dataset import CNNDataset
from folkfriend.cnn.model import assemble_model
from tensorflow import keras


def main(args):
    train_ds = CNNDataset(args.dir, sub_dir='train')
    val_ds = CNNDataset(args.dir, sub_dir='val')

    train_data, train_steps = train_ds.build(args.batch_size)
    val_data, _ = val_ds.build(args.batch_size)

    model = assemble_model()
    model.compile(optimizer=keras.optimizers.Adam(args.learning_rate),
                  loss=keras.losses.CategoricalCrossentropy())
    model.summary()

    if args.weights:
        # TODO reload entire model not just weights
        model.load_weights(args.weights, by_name=True, skip_mismatch=True)

    log_dir = os.path.join('logs', args.name)
    model_dir = os.path.join('models', args.name)
    model_path = os.path.join(model_dir, '{epoch:03d}.h5')

    pathlib.Path(log_dir).mkdir(parents=True, exist_ok=True)
    pathlib.Path(model_dir).mkdir(parents=True, exist_ok=True)

    callbacks = [keras.callbacks.ModelCheckpoint(model_path),
                 keras.callbacks.TensorBoard(log_dir=log_dir,
                                             profile_batch=0)]

    print(f'Beginning training of {args.name} with {train_steps} '
          f'batches per epoch')

    model.fit(train_data,
              epochs=args.epochs,
              initial_epoch=0,  # TODO
              callbacks=callbacks,
              validation_data=val_data,
              # steps_per_epoch=train_steps,    # TODO this breaks training
              batch_size=args.batch_size)


if __name__ == '__main__':
    path_timestamp = datetime.now().strftime('%H%M%S-%d%m%Y')
    parser = argparse.ArgumentParser()
    parser.add_argument('-d', '--dir',
                        default=os.path.join(str(pathlib.Path.home()),
                                             'datasets',
                                             'folkfriend'),
                        help='Path to dataset directory')
    parser.add_argument('-n', '--name',
                        help='A label to use for this training run. Models'
                             ' will be saved to models/<name> and logs to '
                             'logs/<name>. Defaults to a timestamp of the '
                             'current time.',
                        default=datetime.now().strftime('%d-%b-%Y-%H%M%S'))
    parser.add_argument('-e', '--epochs', default=5, type=int)
    parser.add_argument('-bs', '--batch-size', default=512, type=int)
    parser.add_argument('-lr', '--learning-rate', default=0.001, type=float)
    parser.add_argument('-w', '--weights',
                        help='Restore model using previously trained weights')
    main(parser.parse_args())
