from folkfriend import ff_config

BASE_MAP = {
    72: 'c',
    73: '^c',
    74: 'd',
    75: '^d',
    76: 'e',
    77: 'f',
    78: '^f',
    79: 'g',
    80: '^g',
    81: 'a',
    82: '^a',
    83: 'b',
}


def midi_to_abc(midi):
    apos = 0
    commas = 0

    while midi >= 84:
        apos += 1
        midi -= 12

    while midi <= 71:
        commas += 1
        midi += 12

    base = BASE_MAP[midi]

    if commas >= 1:
        base = base.upper()
        commas -= 1

    return base + ',' * commas + "'" * apos


def decoded_to_abc(decoded):
    hold = 0
    last_n = None
    out = []

    for n in decoded:
        if n == last_n:
            hold += 1
            continue
        elif hold:
            out.append(str(hold + 1))
            hold = 0

        out.append(f' {midi_to_abc(ff_config.MIDI_LOW + n)}')
        last_n = n

    return ''.join(out)


ABC_MAP = {i: midi_to_abc(ff_config.MIDI_LOW + i)
           for i in range(ff_config.MIDI_NUM)}
