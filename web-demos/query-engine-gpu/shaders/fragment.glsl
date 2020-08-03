precision mediump float;
precision mediump int;

varying vec2 pixelSpacePositionFloat;

uniform int fragmentSize;
uniform int fragmentsX;  // input texture width / fragmentSize
uniform int fragmentsY;  // input texture height

void main() {
  ivec2 pixelSpacePosition = ivec2(
    int(pixelSpacePositionFloat.x * float(fragmentsX * fragmentSize)),
    int(pixelSpacePositionFloat.y * float(fragmentsY))
  );

  // The number of entries in the alignment matrix separating
  //  this pixel from the top or right edge, traversed in a
  //  diagonal line (top right to / from bottom left)
  float diagonalIndex = mod(float(pixelSpacePosition.x), float(fragmentSize));

  int fragmentXIndex = int(floor(float(pixelSpacePosition.x) / float(fragmentSize)));
  int fragmentYIndex = pixelSpacePosition.y;

  // Index from top left to right, then down to next row.
  int fragmentIndex = fragmentYIndex * fragmentsX + fragmentXIndex;

  // View diagonal index values
//   gl_FragColor = vec4(float(diagonalIndex) / float(fragmentSize), 0.0, 0.0, 1.0);

  // View fragment index values
//   gl_FragColor = vec4(float(fragmentIndex) / float(fragmentsX * fragmentsY), 0.0, 0.0, 1.0);


}