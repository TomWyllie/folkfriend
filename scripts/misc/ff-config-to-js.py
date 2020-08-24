"""Both the python parts of the folkfriend app and the javascript parts need
    the same global variables set that control various parts of the signal
    processing / transcription / query engine pipeline. This script creates
    a javascript loadable version of the python config."""

import json
import re

# noinspection PyUnresolvedReferences
from folkfriend.ff_config import *

production_only = re.compile(r'^[A-Z_]+[A-Z]$')
prod_vars = {lv: v for lv, v in locals().items() if production_only.match(lv)}

js_template = f'const FFConfig = {json.dumps(prod_vars)}'

with open('ff-config.js', 'w') as f:
    f.write(js_template)
