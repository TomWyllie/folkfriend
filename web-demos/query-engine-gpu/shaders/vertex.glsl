attribute vec4 clipSpacePosition;
varying vec2 pixelSpacePosition;

void main() {
  // TODO this 255.0 should be taken from the dimensions of the input
  //  fragments image and not hardcoded. But that's where the value comes from.
  pixelSpacePosition = 255.0 * (clipSpacePosition.xy * 0.5 + 0.5);

  // Our positions are very simple, we are just rendering a rectangle.
  gl_Position = clipSpacePosition;
}