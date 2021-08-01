import csv
import argparse


def main(results_path):
    with open(results_path) as f:
        reader = csv.DictReader(f)
        results = list(reader)

    for i, r in enumerate(results):
        # Type conversion
        results[i]['rank'] = int(r['rank'])

    subsets = ('fergal', 'cambridge', 'martial')

    for subset in subsets:
        ss = [r for r in results if subset in r['rel_path']]
        print(top_tiers(ss, label=subset))


def top_tiers(results, label='all'):
    top_one = sum(1 for r in results if r['rank'] == 0)
    top_five = sum(1 for r in results if r['rank'] <= 4)
    top_hund = sum(1 for r in results if r['rank'] <= 99)

    return (
        '{label}_top_one,{:.4f}\n'
        '{label}_top_five,{:.4f}\n'
        '{label}_top_hund,{:.4f}\n').format(
        top_one / len(results),
        top_five / len(results),
        top_hund / len(results),
        label=label
    )


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('csv', default='results.csv', help='Results CSV file')
    args = parser.parse_args()
    main(args.csv)
