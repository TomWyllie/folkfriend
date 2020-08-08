"""cat query_data.txt | python build_partition_images.py"""
import sys
import numpy as np
import imageio


def main():
    shards = list(line.strip() for line in sys.stdin)


if __name__ == '__main__':
    main()
