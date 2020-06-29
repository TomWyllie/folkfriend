import argparse
import os
import pathlib
from datetime import datetime

from folkfriend.cnn_png_dataset import CNNPngDataset
from folkfriend.cnn_trainer import ModelTrainer


def main(dataset_path, model_dir, epochs, batch_size):
    midi_dataset = CNNPngDataset(path=dataset_path)

    model_path = os.path.join(model_dir, 'model')
    trainer = ModelTrainer(midi_dataset.dataset,
                           model_path=model_path,
                           epochs=epochs,
                           batch_size=batch_size)

    pathlib.Path(model_dir).mkdir(parents=True, exist_ok=True)
    trainer.train()


if __name__ == '__main__':
    path_timestamp = datetime.now().strftime('%H%M%S-%d%m%Y')
    parser = argparse.ArgumentParser()
    parser.add_argument('-d', '--dataset',
                        help='Dataset folder used in the generate_dataset '
                             'script',
                        default='P:/datasets/png-cnn')  # Use windows for GPU
    parser.add_argument('-m', '--model',
                        help='Output directory to save trained model to',
                        default='model-{}'.format(path_timestamp))
    parser.add_argument('-e', '--epochs', default=5, type=int)
    parser.add_argument('-bs', '--batch-size', default=32, type=int)
    args = parser.parse_args()
    main(args.dataset, args.model, args.epochs, args.batch_size)
