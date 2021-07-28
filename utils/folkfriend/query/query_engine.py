import numpy as np
from folkfriend.query import aligner
from folkfriend.query import heuristic_match

from tqdm.contrib.concurrent import process_map


class QueryEngine:
    def __init__(self, contour_data) -> None:
        self.contour_data = contour_data
        self.heuristic_contour_data = heuristic_match.build_heuristic_index(
            contour_data)

        # How many contours do we repass with the expensive alignment algorithm
        self.nw_num = 500      

    def run_query(self, query):

        matches = heuristic_match.heuristic_match(
            self.heuristic_contour_data, query)

        top_n_settings = [s_id for (s_id, _) in matches[:self.nw_num]]
        top_n_contours = [self.contour_data[s_id] for s_id in top_n_settings]


        pmap_data = []

        for setting_id, contour in zip(top_n_settings, top_n_contours):
            pmap_data.append([query, contour, setting_id])

        scores = process_map(nw_wrapper, pmap_data,
            desc='Querying Audio Files', chunksize=1, disable=True)
 
        best_matches = sorted(scores, key=lambda x: x[1], reverse=True)
        return best_matches[:100]

def nw_wrapper(args):
    query, contour, setting_id = args
    score = aligner.needleman_wunsch_fast(contour, query)
    return setting_id, score