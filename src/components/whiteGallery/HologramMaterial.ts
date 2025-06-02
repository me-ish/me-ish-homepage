// src/components/whiteGallery/HologramMaterial.ts
import { shaderMaterial } from '@react-three/drei';
import { extend } from '@react-three/fiber';
import * as THREE from 'three';

// Uniform 型定義
interface HologramMaterialUniforms {
  time: number;
  color: THREE.Color;
  opacity: number;
  [key: string]: any; // uniform拡張エラー防止
}

// shaderMaterial 作成
const HologramMaterial = shaderMaterial(
  {
    time: 0,
    color: new THREE.Color(0xccffff),
    opacity: 1.0,
  } as HologramMaterialUniforms,
  // vertex shader
  /* glsl */ `
    precision mediump float;
    uniform float time;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vec3 p = position;

      p.z += sin(uv.x * 50.0 + time * 4.0) * 0.015;
      p.z += sin(uv.y * 80.0 + time * 5.0) * 0.008;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  // fragment shader
  /* glsl */ `
    precision mediump float;
    uniform vec3 color;
    uniform float opacity;
    uniform float time;
    varying vec2 vUv;

    void main() {
      float scanline = sin(vUv.y * 300.0 + time * 10.0) * 0.5 + 0.5;
      float grid = step(0.95, mod(vUv.x * 30.0 + time * 2.0, 1.0));
      float strength = scanline * (2.0 - grid);
      gl_FragColor = vec4(color * strength, opacity * strength);
    }
  `
);

// R3Fへ登録
extend({ HologramMaterial });

// JSX使用許可
export { HologramMaterial };
