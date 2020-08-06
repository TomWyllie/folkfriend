class NeedlemanWunsch {
    /*
        Javascript implementation of the Needleman–Wunsch algorithm for global sequence alignment.
        Based on:
            https://en.wikipedia.org/wiki/Needleman%E2%80%93Wunsch_algorithm
            http://biopython.org/DIST/docs/api/Bio.pairwise2-module.html
     */

    constructor(seqA, seqB, matchScore, mismatchScore, linearGapPenalty, penaliseEndGaps) {
        this._seqA = seqA;
        this._seqB = seqB;

        // seqA down side of matrix, seqB along top. Buffer stores matrix as
        //  (*row_0, *row_1, ..., *row_n)
        this._rows = this._seqA.length + 1;
        this._cols = this._seqB.length + 1;
        this._buffer = new Int16Array(this._cols * this._rows);

        this._matchScore = matchScore;
        this._mismatchScore = mismatchScore;

        // Penalising end gaps is baked into algorithm for speed gains
        if(penaliseEndGaps) {
            throw "Penalising end gaps is not supported"
        }

        this._linearGapPenalty = linearGapPenalty;

    }

    getAlignmentScore() {
        const firstAGap = this._linearGapPenalty;
        const firstBGap = this._linearGapPenalty;

        /*
        // To begin with, initialise first row and column with gap scores. This is like opening up
        //  i gaps at the beginning of sequence A or B.
        if(this._penaliseEndGaps) {
            // TODO not used in folkfriend, could implement someday
            throw "Penalising end gaps is not supported"
        } else {
            // We need to fill the first row and columns with zero. Serendipitously Uint16Arrays are
            //  initialised with all values zero so we don't need to do anything here.
        }
        */

        // Now initialize the col 'matrix'. Actually this is only a one dimensional list, since at
        //  each step only the column scores from the previous row are used.
        let colScores = Array.from({length: this._seqB.length + 1}, (_, i) => NeedlemanWunsch._calcAffinePenalty(i, this._linearGapPenalty));
        colScores[0] = 0;

        // Move these steps out of loop to save re-allocating many times.
        let rowOpen; let rowExtend;
        let colOpen; let colExtend;
        for(let row = 1; row < this._seqA.length + 1; row++) {
            let rowScore = NeedlemanWunsch._calcAffinePenalty(row, this._linearGapPenalty);
            for(let col = 1; col < this._seqB.length + 1; col++) {
                // Calculate the score that would occur by extending the alignment without gaps.
                let noGapScore = this._getScore(row - 1, col - 1) + this._computePairwiseScore(this._seqA[row - 1], this._seqB[col - 1]);

                // Check score that would occur if there were a gap in sequence A, either from opening a new one
                //  or extending an existing one.
                if(row === this._seqA.length) {
                    rowOpen = this._getScore(row, col - 1);
                    rowExtend = rowScore;
                } else {
                    rowOpen = this._getScore(row, col - 1) + firstAGap;
                    // console.log(this._getScore(row, col - 1));
                    // console.log(this._buffer);
                    rowExtend = rowScore + this._linearGapPenalty;
                }
                rowScore = Math.max(rowOpen, rowExtend);

                if(col === this._seqB.length) {
                    colOpen = this._getScore(row - 1, col);
                    colExtend = colScores[col];
                } else {
                    colOpen = this._getScore(row - 1, col) + firstBGap;
                    colExtend = colScores[col] + this._linearGapPenalty;
                }
                colScores[col] = Math.max(colOpen, colExtend);


                let bestScore = Math.max(noGapScore, colScores[col], rowScore);
                this._setScore(row, col, bestScore);
            }
        }

        // For debugging
        // this._logMatrix();

        // Return last entry in score matrix
        return this._getScore(this._rows - 1, this._cols - 1);
    }

    _setScore(row, col, score) {
        this._buffer[row * this._cols + col] = score;
    }

    _getScore(row, col) {
        return this._buffer[row * this._cols + col];
    }

    _computePairwiseScore(a, b) {
        return a === b ? this._matchScore : this._mismatchScore;
    }

    // noinspection JSUnusedGlobalSymbols
    _logMatrix() {
        for(let row = 0; row < this._rows; row++) {
            let chunk = this._buffer.slice(row * this._cols, (row+1) * this._cols);
            console.log("(" + String(row) + ")", chunk.join('\t'));
        }
    }

    static _calcAffinePenalty(length, penalty) {
        return length <= 0 ? 0 : penalty * (length + 1);
    }
}