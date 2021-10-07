from tqdm import tqdm


def heuristic_match(heuristic_contour_data, query):
    query_heuristic = trigrams(query)

    heuristic_scores = []

    for setting_id, heuristic in heuristic_contour_data.items():
        score = len(heuristic & query_heuristic)
        heuristic_scores.append((setting_id, score))

    return sorted(heuristic_scores, key=lambda x: x[1], reverse=True)


def build_heuristic_index(contour_data):
    heuristic_contour_data = {}

    for setting_id, contour in tqdm(contour_data.items(),
                                    desc='Building heuristic index'):
        heuristic = trigrams(contour)
        heuristic_contour_data[setting_id] = heuristic

    return heuristic_contour_data


def trigrams(seq):
    return {tuple(seq[i:i+3]) for i in range(len(seq) - 3)}


if __name__ == '__main__':
    print(trigrams([1, 2, 3, 4, 5, 6, 7, 8]))
