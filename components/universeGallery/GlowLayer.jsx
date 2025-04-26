// src/components/CenterCore/GlowLayer.jsx
import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function GlowLayer({ position = [0, 5, 0], radius = 1.2, color = '#00a1e9' }) {
  const materialRef = useRef()

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += 0.02 // スピードUP
    }
  })

  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(color) }
        }}
        vertexShader={`
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec3 vNormal;
          uniform vec3 uColor;
          uniform float uTime;

          void main() {
            // 滲みのベースフェード
            float base = 0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0));
            base = clamp(base, 0.0, 1.0);

            // ゆらぎ（波的揺れ）
            float wobble = sin(dot(vNormal.xy, vec2(3.0, 3.0)) + uTime * 4.0);

            // ノイズ（縞模様的ゆらぎ）
            float noise = sin(dot(vNormal.xy, vec2(12.0, 5.0)) + uTime * 6.0);

            // 合成：波ゆらぎ＋ノイズゆらぎ
            float distortion = wobble * 0.25 + noise * 0.15;

            // 全体の強度合成
            float intensity = pow(base + distortion, 2.0);

            // 発光色をそのまま強調
            gl_FragColor = vec4(uColor * intensity, intensity * 0.8);
          }
        `}
      />
    </mesh>
  )
}
