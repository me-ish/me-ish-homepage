import { extend } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import * as THREE from 'three'

const HologramMaterial = shaderMaterial(
  {
    time: 0,
    color: new THREE.Color(0x88ffff),
    opacity: 1.0,
  },
  /* Vertex Shader */
  /* glsl */`
uniform float time;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 p = position;

  // --- ここで斜め45度回転 ---
  vec2 rotatedUv = vec2(
    uv.x * 0.707 - uv.y * 0.707,
    uv.x * 0.707 + uv.y * 0.707
  );

  p.z += sin(rotatedUv.x * 60.0 + time * 5.0) * 0.015;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}

  `,
  /* Fragment Shader */
  /* glsl */`
uniform vec3 color;
uniform float opacity;
uniform float time;
varying vec2 vUv;

void main() {
  vec2 rotatedUv = vec2(
    vUv.x * 0.707 - vUv.y * 0.707,
    vUv.x * 0.707 + vUv.y * 0.707
  );

  float scanline = sin(rotatedUv.y * 120.0 + time * 20.0) * 0.5 + 0.5;

  float flicker = sin(time * 6.0 + rotatedUv.x * 30.0) * 0.05 + 0.95;

  float gradient = smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);

  float glow = scanline * flicker * gradient;
  gl_FragColor = vec4(color * glow * 3.0, opacity * glow);
}

  `
)

extend({ HologramMaterial })

