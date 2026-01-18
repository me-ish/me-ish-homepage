'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ForestParticles - 森の浮遊粒子（ホタル・花粉・木漏れ日の塵）
 *
 * Points を使った軽量パーティクル。
 * ゆっくり上下に浮遊し、森の空気感を演出。
 */

// 定数
const PARTICLE_COUNT = 200;
const SPREAD_RADIUS = 80;
const HEIGHT_MIN = 0.5;
const HEIGHT_MAX = 15;
const PARTICLE_SIZE = 0.15;
const PARTICLE_COLOR = '#ffffaa';
const FLOAT_SPEED = 0.3;
const FLOAT_AMPLITUDE = 0.5;

export default function ForestParticles(): React.JSX.Element {
  const pointsRef = useRef<THREE.Points>(null);
  const timeRef = useRef(0);

  // パーティクル位置の初期化
  const { geometry, basePositions } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const phases = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // XZ平面でランダム配置（円形分布）
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * SPREAD_RADIUS;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = HEIGHT_MIN + Math.random() * (HEIGHT_MAX - HEIGHT_MIN);
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      // サイズにバリエーション
      sizes[i] = PARTICLE_SIZE * (0.5 + Math.random() * 1.0);

      // 浮遊の位相をランダムに
      phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

    return { geometry: geo, basePositions: positions.slice() };
  }, []);

  // シェーダーマテリアル
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(PARTICLE_COLOR) },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        attribute float size;
        attribute float phase;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;

        void main() {
          vec3 pos = position;

          // ゆっくり上下に浮遊
          pos.y += sin(uTime * ${FLOAT_SPEED} + phase) * ${FLOAT_AMPLITUDE};

          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * uPixelRatio * (200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;

          // 距離に応じてフェード
          vAlpha = smoothstep(100.0, 20.0, -mvPosition.z);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;

        void main() {
          // 円形のソフトパーティクル
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center) * 2.0;
          float alpha = 1.0 - smoothstep(0.0, 1.0, dist);

          gl_FragColor = vec4(uColor, alpha * vAlpha * 0.6);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  // アニメーション（1箇所に集約）
  useFrame((_, delta) => {
    timeRef.current += delta;
    if (material.uniforms) {
      material.uniforms.uTime.value = timeRef.current;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} material={material} />
  );
}
