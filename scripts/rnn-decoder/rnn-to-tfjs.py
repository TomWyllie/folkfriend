import argparse

# noinspection PyUnresolvedReferences,PyPackageRequirements
import tensorflowjs as tfjs

from model import build_model

parser = argparse.ArgumentParser()
parser.add_argument('model', type=str,
                    help='Input model to convert')
args = parser.parse_args()

out_dir = args.model
out_dir = out_dir.replace('.h5', '')
out_dir += '-js'

model = build_model()
model.compile()
model.load_weights(args.model)
model.summary()

# if args.restore:
#     model.load_weights(args.restore, by_name=True, skip_mismatch=True)

tfjs.converters.save_keras_model(model, out_dir)
