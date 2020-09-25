precision mediump float;
precision mediump int;

attribute vec4 clipSpacePosition;
varying vec2 pos;

//uniform uint fragmentSize;
//uniform uint fragmentsX;  // input texture width / fragmentSize
uniform int fragmentsY;// input texture height

void main() {
    // Input is a square to width and height are the same
    pos = clipSpacePosition.xy * 0.5 + 0.5;

    // Our positions are very simple, we are just rendering a rectangle.
    gl_Position = clipSpacePosition;
}