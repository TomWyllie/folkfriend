precision highp float;
attribute vec3 vPosition;
varying vec2 vCoord;
void main(void) {
    vCoord = vec2((vPosition.s+1.0)/2.0, (vPosition.t+1.0)/2.0);
    gl_Position = vec4(vPosition, 1.0);
}
