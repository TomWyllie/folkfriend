precision highp float;

// These textures are uniform, and constant for the entire computation
uniform sampler2D uPingPongSampler;
uniform sampler2D uRowsAndCols;
uniform sampler2D uStrings;
uniform sampler2D uQuery;

// These scalars are uniform, and constant for the entire computation
uniform int queryLength;
uniform int fragmentLength;
uniform int diagLength;
uniform int numFragments;
uniform int numStages;

// These scalars are uniform, but updated at each stage of computation
uniform int stage;
uniform int maxIndex;
uniform int relIndexAbove;
uniform int relIndexLeft;
uniform int relIndexAboveLeft;

varying vec2 vCoord;

float computeNextCellValue(void) {
   /*

    Query texture (Really 1D, implemented as 2D):

        ←----- Query Length -----→
       ↑
       1
       ↓

    Strings texture (Really 2D, implemented as 2D):

        ←----- Fragment Length -----→
       ↑
       ¦
       ¦
       ¦
       Number of fragments
       ¦
       ¦
       ¦
       ↓

    Ping pong texture (Really 3D, implemented as 2D):
           ____________________________________
          /                                   /|
    (RGBA gives depth for previous states)   / |
        /                                   /  |
        ←----- Matrix Diagonal Length -----→   |
       ↑                                   ↑   |
       ¦                                   ¦   |
       ¦                                   ¦   |
       ¦                                   ¦   |
       Number of fragments                 ¦   |
       ¦                                   ¦   |
       ¦                                   ¦  /
       ¦                                   ¦ /
       ↓___________________________________↓/

    Rows and columns texture (Really 2D, implemented as 2D):

        ←----- Matrix Diagonal Length -----→
       ↑
       ¦
       Number of compute stages
       ¦
       ↓

    */

    // The area of the rectangle excluded by the parallelogram (actually a trapezium)
    if(vCoord.x > (float(1 + maxIndex)) / float(diagLength)) {
       return 0.0;     // 127 -> our zero point
    }/* else {
        return 1.0;
    }*/

    int nextCellValue;
    float leftGapPenalty = 1.0 / 256.0;
    float aboveGapPenalty = 1.0 / 256.0;
    float mismatchPenalty = 2.0 / 256.0;

    // Removing one here to these rows and columns correspond to the indices
    //  of the strings. Remember that we added in an extra row and column of zeroes!
    vec4 rowAndCol = texture2D(uRowsAndCols, vec2(vCoord.x, (0.5 + float(stage)) / float(numStages)));
    int row = int(256.0 * rowAndCol.r + 0.5) - 1;   // Red = row
    int col = int(256.0 * rowAndCol.g + 0.5) - 1;   // Green = colour

    if(vCoord.x < 1.0 / float(diagLength)) {
        // Edge case
        if(row == -1) {
            // Top-most row value is ALWAYS zero.
            return 127.5 / 256.0;     // 127 -> our zero point
        } else {
            // Earliest index is not on the top row. Then it MUST be on the right-most column.
            //  In which case we don't apply a gap penalty from the cell directly above.
            aboveGapPenalty = 0.0;
            if(maxIndex == 0) {
                // Edge-edge case - bottom right corner has no gap penalty at all
                // (above or left)
                leftGapPenalty = 0.0;
            }
        }
    } else if(vCoord.x > (float(maxIndex)) / float(diagLength)) {
        if (col == -1) {
            // Left-most column value is ALWAYS zero.
            return 127.5 / 256.0;     // 127 -> our zero point
        } else {
            // Last index is not on the left-most column. Then it MUST be on the
            //  bottom row. In which case we don't apply a gap penalty from the
            //  cell directly to the left.
            leftGapPenalty = 0.0;
            // TODO debugging
            //            return 1.0;
        }
    }

//    return 0.0;

    vec4 aboveCell = texture2D(uPingPongSampler, vCoord + vec2(float(relIndexAbove) / float(diagLength), 0.0));
    vec4 leftCell = texture2D(uPingPongSampler, vCoord + vec2(float(relIndexLeft) / float(diagLength), 0.0));
    vec4 aboveLeftCell = texture2D(uPingPongSampler, vCoord + vec2(float(relIndexAboveLeft) / float(diagLength), 0.0));

    int queryChar = int(256.0 * texture2D(uQuery, vec2((float(row) + 0.5) / float(queryLength), 0.0)).r);
    int stringChar = int(256.0 * texture2D(uStrings, vec2((float(col) + 0.5) / float(fragmentLength), vCoord.y)).r);

    if(queryChar == stringChar) {
        mismatchPenalty = -2.0 / 256.0;   // Negative penalty => reward
    }

    float aboveCellScore = aboveCell.r - aboveGapPenalty;
    float leftCellScore = leftCell.r - leftGapPenalty;
    float aboveLeftCellScore = aboveLeftCell.g - mismatchPenalty;

    return max(max(aboveCellScore, leftCellScore), aboveLeftCellScore);
}

void main(void) {
    // For now we're only using the R and G channels for a total of 256 possible
    //  scores: [-127, 128]

    // Stages:
    // (Red channel),  (Green channel),  (Blue channel),  (Alpha channel)
    //  Stage N - 1      Stage N - 2           0                 0
    // TODO use blue/alpha bits to expand max score

    // TODO debugging
//    return texture2D(uStrings, vec2(0.0, 0.0));
//    gl_FragColor = texture2D(uRowsAndCols, vec2(0.2, 0.8));
//    gl_FragColor = texture2D(uQuery, vec2(0.0, 0.0));
//    gl_FragColor = texture2D(uStrings, vec2(0.0, 0.0));
//    return;

    vec4 lastState = texture2D(uPingPongSampler, vCoord);

    // Reassign the red channel to green, and the new value to red, thus
    //  propagating backwards the store previous states.
    gl_FragColor = vec4(computeNextCellValue(), lastState.r, 0.0, 0.0);
}
