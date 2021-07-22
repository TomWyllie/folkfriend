export PYTHONPATH=`pwd`/utils/:$PYTHONPATH
#export TF_FORCE_GPU_ALLOW_GROWTH=true	# Memory issues. https://github.com/tensorflow/tensorflow/issues/24496
. ./venv/bin/activate
pip install -r requirements.txt
