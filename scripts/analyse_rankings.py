import csv
import sys


def main():
    reader = csv.DictReader(sys.stdin)
    results = list(reader)

    for i, r in enumerate(results):
        # Type conversion
        results[i]['rank'] = int(r['rank'])
    
    overall_top_one = sum(1 for r in results if r['rank'] == 0) / len(results)
    top_row = 'overall_top_one,,'
    bottom_row = '{:.4f},,'.format(overall_top_one)

    subsets = ('fergal', 'cambridge', 'martial')
    for subset in subsets:
        ss = [r for r in results if subset in r['rel_path']]
        t, b = top_tiers(ss, label=subset)
        top_row += t
        bottom_row += b

    print(top_row)
    print(bottom_row)


def top_tiers(results, label='all'):
    top_one = sum(1 for r in results if r['rank'] == 0)
    top_five = sum(1 for r in results if 0 <= r['rank'] <= 4)
    top_hund = sum(1 for r in results if 0 <= r['rank'] <= 99)

    top_row = '{label}_top_one,{label}_top_five,{label}_top_hund,,'.format(label=label)
    bottom_row = '{:.4f},{:.4f},{:.4f},,'.format(
        top_one / len(results),
        top_five / len(results),
        top_hund / len(results),
    )

    return top_row, bottom_row


if __name__ == '__main__':
    main()
    # parser = argparse.ArgumentParser()
    # parser.add_argument('csv', default='results.csv', help='Results CSV file')
    # args = parser.parse_args()
    # main(args.csv)
