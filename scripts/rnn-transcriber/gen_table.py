import string

s = string.ascii_letters + string.digits

# CLASSES = 56
CLASSES = 32
s = s[:CLASSES]

with open('/home/tom/datasets/rnn-dummy/table.txt', 'w') as f:
    f.write('\n'.join(s))
    f.write('\n<BLK>')
