export PYTHONPATH=`pwd`/utils/:$PYTHONPATH
. ./venv/bin/activate
pip install -r requirements.txt
echo "Using python environment" `which python`
