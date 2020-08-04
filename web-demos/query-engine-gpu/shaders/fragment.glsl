precision mediump float;
precision mediump int;

// This is how we know where we are in the texture
varying vec2 pixelSpacePositionFloat;

// This is how we access texture data
uniform sampler2D lastStage;// Load the data from the last stage
uniform sampler2D fragments;
uniform sampler2D query;

// Global constant ints
uniform int fragmentLength;
uniform int fragmentsX;// input texture width / fragmentSize
uniform int fragmentsY;// input texture height

// Constant for duration of computation but need to 
//  know query first.
uniform int queryLength;
uniform int queryImgDataLength;

// These are updated on each step (but might not change every step)
uniform int length;
uniform bool firstIndexTop;
uniform bool lastIndexBottom;
uniform int tMinusOneOffset;
uniform int tMinusTwoOffset;
uniform int fragmentOffset;
uniform int queryOffset;

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


//ivec2 getTMinusOneScores(diagonalIndex, fragmentXIndex, fragmentYIndex) {
//    int index = fragmentXIndex * fragmentLength + diagonalIndex + tMinusOneOffset;
//    float fIndexXLeft = float(index) / float(fragmentXIndex * fragmentLength - 1);
//    float fIndexXTop = float(index - 1) / float(fragmentXIndex * fragmentLength - 1);
//    float fIndexY = float(fragmentYIndex) / float(fragmentsY);
//    float pixelLeft = texture2D(lastStage, vec2(fIndexXLeft, fIndexY));
//    float pixelTop = texture2D(lastStage, vec2(fIndexXTop, fIndexY));
//    return ivec2(int(255.0 * pixelLeft.r), int(255.0 * pixelTop.r));
//}

int getTMinusTwoScore(int diagonalIndex, int fragmentXIndex, int fragmentYIndex) {
    int index = fragmentXIndex * fragmentLength + diagonalIndex + tMinusTwoOffset;
    float fIndexX = float(index) / float(fragmentXIndex * fragmentLength - 1);
    float fIndexY = float(fragmentYIndex) / float(fragmentsY);
    vec4 pixel = texture2D(lastStage, vec2(fIndexX, fIndexY));
    return int(255.0 * pixel.g);
}

int getFragmentCharacter(int diagonalIndex, int fragmentXIndex, int fragmentYIndex) {
    int index = fragmentXIndex * fragmentLength + fragmentOffset - diagonalIndex;
    float fIndexX = float(index) / float(fragmentXIndex * fragmentLength - 1);
    float fIndexY = float(fragmentYIndex) / float(fragmentsY);
    vec4 fChar = texture2D(fragments, vec2(fIndexX, fIndexY));
    int char = int(fChar.r * 255.0);
    return char;
}

int getQueryCharacter(int diagonalIndex) {
    int index = queryOffset + diagonalIndex;
    int pixelType = int(mod(float(index), 4.0));
    int pixelIndex = int(floor(float(index) / 4.0));

    float fPixelIndex = float(pixelIndex) / float(queryImgDataLength - 1);
    vec4 pixel = texture2D(query, vec2(fPixelIndex, 0.5));

    // TODO investigate if this branching is worth the tiny memory efficiency
    //  from stacking values into pixels
    float fChar;
    if (pixelType == 0) {
        fChar = pixel.r;
    } else if (pixelType == 1) {
        fChar = pixel.g;
    } else if (pixelType == 2) {
        fChar = pixel.b;
    } else if (pixelType == 3) {
        fChar = pixel.a;
    }

    int char = int(fChar * 255.0);
    return char;
}

float computeCell() {
    // Pixel space position goes from range [0, 1] on X and Y
    // We want to map this to [0, ping pong buffer width) on X
    // We want to map this to [0, ping pong buffer height) on Y
    ivec2 pixelSpacePosition = ivec2(
        int(pixelSpacePositionFloat.x * (float(fragmentsX * fragmentLength) - 1.0)),
        int(pixelSpacePositionFloat.y * (float(fragmentsY) - 1.0))
    );

    // The number of entries in the alignment matrix separating
    //  this pixel from the top or right edge, traversed in a
    //  diagonal line (top right to / from bottom left)
    int diagonalIndex = int(mod(float(pixelSpacePosition.x), float(fragmentLength)));

    if (diagonalIndex >= length) {
        return 0.0;   // 0 = unused
    }

    int leftGapPenalty = 1;
    int topGapPenalty = 1;
    int mismatchPenalty = 2;

    if (diagonalIndex == length - 1) {
        if (lastIndexBottom) {
            leftGapPenalty = 0;
        } else {
//            return 127.0;     // 127 = origin
            return 120.0;     // 127 = origin
        }
    }

    if (diagonalIndex == 0) {
        if (firstIndexTop) {
//            return 127.0;     // 127 = origin
            return 130.0;     // 127 = origin
        } else {
            topGapPenalty = 0;
        }
    }

    // Which fragment does this pixel correspond to?
    int fragmentXIndex = int(floor(float(pixelSpacePosition.x) / float(fragmentLength)));
    int fragmentYIndex = pixelSpacePosition.y;

        int index = fragmentXIndex * fragmentLength + diagonalIndex + tMinusOneOffset;
    float fIndexXLeft = float(index) / float(fragmentXIndex * fragmentLength - 1);
    float fIndexXTop = float(index - 1) / float(fragmentXIndex * fragmentLength - 1);
    float fIndexY = float(fragmentYIndex) / float(fragmentsY);
    vec4 pixelLeft = texture2D(lastStage, vec2(fIndexXLeft, fIndexY));
    vec4 pixelTop = texture2D(lastStage, vec2(fIndexXTop, fIndexY));
    int leftScoreLast = int(255.0 * pixelLeft.r);
    int topScoreLast = int(255.0 * pixelTop.r);


    int tMinusTwoScore = getTMinusTwoScore(diagonalIndex, fragmentXIndex, fragmentYIndex);
    int fragChar = getFragmentCharacter(diagonalIndex, fragmentXIndex, fragmentYIndex);
    int queryChar = getQueryCharacter(diagonalIndex);

    if (fragChar == queryChar) {
        mismatchPenalty = -2;   // Negative penalty is reward
    }

    int topScore = topScoreLast - topGapPenalty;
    int leftScore = leftScoreLast - leftGapPenalty;
    int topLeftScore = tMinusTwoScore - mismatchPenalty;

    return max(max(float(topScore), float(leftScore)), float(topLeftScore));
}

void main() {
    /*
    //  // Pixel space position goes from range [0, 1] on X and Y
    //  // We want to map this to [0, ping pong buffer width) on X
    //  // We want to map this to [0, ping pong buffer height) on Y
    //  ivec2 pixelSpacePosition = ivec2(
    //    int(pixelSpacePositionFloat.x * (float(fragmentsX * fragmentSize) - 1.0)),
    //    int(pixelSpacePositionFloat.y * (float(fragmentsY) - 1.0))
    //  );
    //
    //  // The number of entries in the alignment matrix separating
    //  //  this pixel from the top or right edge, traversed in a
    //  //  diagonal line (top right to / from bottom left)
    //  int diagonalIndex = int(mod(float(pixelSpacePosition.x), float(fragmentSize)));
    //
    //  // Which fragment does this pixel correspond to?
    //  int fragmentXIndex = int(floor(float(pixelSpacePosition.x) / float(fragmentSize)));
    //  int fragmentYIndex = pixelSpacePosition.y;

    // Index from top left to right, then down to next row.
    //  int fragmentIndex = fragmentYIndex * fragmentsX + fragmentXIndex;

    // View diagonal index values
    //   gl_FragColor = vec4(float(diagonalIndex) / float(fragmentSize), 0.0, 0.0, 1.0);

    // View fragment index values
    //   gl_FragColor = vec4(float(fragmentIndex) / float(fragmentsX * fragmentsY), 0.0, 0.0, 1.0);

    //  gl_FragColor =  texture2D(lastStage, pixelSpacePositionFloat) + float(diagonalIndex) / 255.0;
    //  gl_FragColor =  texture2D(lastStage, pixelSpacePositionFloat) + float(fragmentIndex) / 1024.0;
    //  gl_FragColor =  texture2D(fragments, pixelSpacePositionFloat);
*/
    vec4 lastState = texture2D(lastStage, pixelSpacePositionFloat);
    float nextCell = computeCell();
    gl_FragColor =  vec4(float(nextCell)/255.0, lastState.r, 0.0, 0.0);
}
