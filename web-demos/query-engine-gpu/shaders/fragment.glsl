precision mediump float;
precision mediump int;

// This is how we know where we are in the texture
varying vec2 pos;

// This is how we access texture data
uniform sampler2D lastStage;// Load the data from the last stage
uniform sampler2D shards;
uniform sampler2D query;

// Global constant ints
uniform float shardLength;
uniform float numShardsX;

// Constant for duration of computation but need to 
//  know query first.
uniform float queryLength;
uniform float queryImgDataLength;

// These are updated on each step (but might not change every step)
uniform int length;
uniform bool firstIndexTop;
uniform bool lastIndexLeft;
uniform float tMinusOneOffset;
uniform float tMinusTwoOffset;
uniform float shardColOffset;
uniform float queryColOffset;

/*
    Query texture (Really 1D, implemented as 2D):

        ←----- Query Length -----→
       ↑
       1
       ↓

    Strings texture (Really 2D, implemented as 2D):

        ←-------------- Fragment Length * fragmentsX --------------→
      ( ←-fragment-→←-fragment-→............←-fragment-→←-fragment-→ )
       ↑
       ¦
       ¦
       ¦
       fragmentsY
       ¦
       ¦
       ¦
       ↓

    Ping pong texture (Really 3D, implemented as 2D):
           ____________________________________
          /                                   /|
    (RGBA gives depth for previous states)   / |
        /                                   /  |
       ↑←- Fragment Length * fragmentsX --→↑   |
       ¦                                   ¦   |
       ¦                                   ¦   |
       ¦                                   ¦   |
       ¦                                   ¦   |
       fragmentsY                          ¦   |
       ¦                                   ¦   |
       ¦                                   ¦  /
       ¦                                   ¦ /
       ↓___________________________________↓/

    Note that whilst the width of the ping pong texture for each fragment
    can be up to fragmentLength, we often use only a subset of that space
    on each iteration (depending on the value of 'length').

    */


float computeCell() {
    // Length refers to unnormalised, width refers to in the image buffer
    float shardWidth = 1.0 / numShardsX;

    // One pixel in the X direction for shard textures
    float px = shardWidth / shardLength;

    // One pixel in the X direction for the query texture
    float pxq = 1.0 / queryImgDataLength;

    float diagonalCols = mod(pos.x, shardWidth);    // X position contribution from progress through current shard
    float shardCols = pos.x - diagonalCols;         // X position contribution from diagonalOffset complete shards

    // Adjust penalties to handle edge cases
    float leftGapPenalty = 1.0;
    float aboveGapPenalty = 1.0;
    float mismatchPenalty = 2.0;

    // Cannot rely on diagonalCols being == 0.0 directly.
    // For example if shardLength = 64, numShardsX = 1, then 64 values
    //  exist. If we scale out this value as an 8-bit integer ie multiplying
    //  by 255.0 then we see the values are 2, 6, 10, ..., as the sampler
    //  chooses a central value. Use an integer instead (see below)

    // Integer of how many diagonal entries we'd have to step over to get to
    //  the TOP or RIGHT edge of the alignment matrix. If this is 0 or length - 1
    //  then we have an edge case.
    int diagonalEntriesToEdge = int(diagonalCols * shardLength * numShardsX);

    // This entry isn't part of the alignment buffer at this stage.
    if (diagonalEntriesToEdge >= length) {
        return 0.0;   // 0 = unused
    }

    // ========================================
    // === Load in data from last iteration ===
    // ========================================

    // Note: these values can be assigned meaningless values if
    //  we're at a buffer edge, in which the scores are handled
    //  differently.

    float cellLeftCol = tMinusOneOffset * px;
    float cellAboveCol = (tMinusOneOffset - 1.0) * px;
    float cellAboveLeftCol = tMinusTwoOffset * px;

    vec4 cellLeft = texture2D(lastStage, vec2(pos.x + cellLeftCol, pos.y));
    vec4 cellAbove = texture2D(lastStage, vec2(pos.x + cellAboveCol, pos.y));
    vec4 cellAboveLeft = texture2D(lastStage, vec2(pos.x + cellAboveLeftCol, pos.y));

    float scoreLeft = 255.0 * cellLeft.r;
    float scoreAbove = 255.0 * cellAbove.r;
    float scoreAboveleft = 255.0 * cellAboveLeft.g;

    // ====================================================
    // === Load in notes from query and shards textures ===
    // ====================================================

    // These columns are relative to the start of the shard / query.
    float shardNoteColRel = float(shardColOffset) * px - diagonalCols;
    float queryNoteColRel = (queryColOffset + float(diagonalEntriesToEdge)) * pxq;

    vec4 pixelShardNote = texture2D(shards, vec2(shardCols + shardNoteColRel, pos.y));
    vec4 pixelQueryNote = texture2D(query, vec2(queryNoteColRel, 0.5));     // 0.5 because only 1 row

    if (pixelShardNote.r == pixelQueryNote.r) {
        mismatchPenalty = -2.0;   // Negative penalty is reward
    }

    // ==========================================
    // === Handle alignment buffer edge cases ===
    // ==========================================

    if (diagonalEntriesToEdge == 0) {
        if (firstIndexTop) {
            // No cell exists anywhere above, as we are on the top edge
            scoreAbove = 127.0;         // 127 = origin
            scoreAboveleft = 127.0;     // 127 = origin
        } else {
            aboveGapPenalty = 0.0;
        }
    }

    if (diagonalEntriesToEdge == length - 1) {
        if (lastIndexLeft) {
            // No cell exists anywhere to the left, as we are on the left edge
            scoreLeft = 127.0;          // 127 = origin
            scoreAboveleft = 127.0;     // 127 = origin
        } else {
            // Cells exist to the left and the top, but we need to set the
            //  left gap penalty differently to allow high scores to
            //  propagate.
            leftGapPenalty = 0.0;
        }
    }

    // Now that we have loaded in relevant scores and penalties,
    //  apply the penalties to update the scores and return the
    //  best value.

    scoreLeft -= leftGapPenalty;
    scoreAbove -= aboveGapPenalty;
    scoreAboveleft -= mismatchPenalty;

    return max(max(scoreLeft, scoreAbove), scoreAboveleft);
}

void main() {
    vec4 lastState = texture2D(lastStage, pos);
    float nextCell = computeCell();
    gl_FragColor =  vec4(nextCell/255.0, lastState.r, 0.0, 0.0);
}
