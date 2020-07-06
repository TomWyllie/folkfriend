import string

s = string.ascii_letters + string.digits

CLASSES = 10
s = s[:CLASSES]

with open('D:/datasets/rnn-dummy/table.txt', 'w') as f:
    f.write('\n'.join(s))
    f.write('\n<BLK>')
