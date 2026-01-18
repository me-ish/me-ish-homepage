'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FLOAT_OUTSIDE } from './floatOutside.constants';

// ============================================================
// 雲レイヤー（プロシージャルノイズでゆっくり流れる）
// ============================================================

const cloudVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cloudFragmentShader = `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uSpeed;
  uniform vec3 uColor;

  varying vec2 vUv;

  // Simple noise function
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;

    // UVスクロール（ゆっくり流れる）
    uv.x += uTime * uSpeed;
    uv.y += uTime * uSpeed * 0.3;

    // ノイズで雲のような模様
    float n = fbm(uv * 3.0);
    n = smoothstep(0.3, 0.7, n);

    // 中心から端に向かってフェードアウト
    vec2 center = vUv - 0.5;
    float dist = length(center) * 2.0;
    float fade = 1.0 - smoothstep(0.5, 1.0, dist);

    float alpha = n * uOpacity * fade;

    gl_FragColor = vec4(uColor, alpha);
  }
`;

function CloudLayer({
  y,
  opacity,
  speed,
  scale,
  color,
  size,
}: {
  y: number;
  opacity: number;
  speed: number;
  scale: number;
  color: string;
  size: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uSpeed: { value: speed },
      uColor: { value: new THREE.Color(color) },
    }),
    [opacity, speed, color]
  );

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, y, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[scale, scale, 1]}
    >
      <planeGeometry args={[size, size]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={cloudVertexShader}
        fragmentShader={cloudFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ============================================================
// 遠景ライト（レイヤー別）
// ============================================================

type LightLayerConfig = {
  count: number;
  radiusMin: number;
  radiusMax: number;
  yMin: number;
  yMax: number;
  size: number;
  opacity: number;
  color: string;
};

function LightLayer({ config }: { config: LightLayerConfig }) {
  const { count, radiusMin, radiusMax, yMin, yMax, size, opacity, color } = config;

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const opacities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = radiusMin + Math.random() * (radiusMax - radiusMin);

      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = yMin + Math.random() * (yMax - yMin);
      positions[i * 3 + 2] = Math.sin(angle) * r;

      opacities[i] = 0.4 + Math.random() * 0.6;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

    return geo;
  }, [count, radiusMin, radiusMax, yMin, yMax]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uSize: { value: size },
        uOpacity: { value: opacity },
        uColor: { value: new THREE.Color(color) },
      },
      vertexShader: `
        attribute float aOpacity;
        varying float vOpacity;
        uniform float uSize;

        void main() {
          vOpacity = aOpacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize * (200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uOpacity;
        uniform vec3 uColor;
        varying float vOpacity;

        void main() {
          vec2 center = gl_PointCoord - 0.5;
          float dist = length(center) * 2.0;
          float alpha = 1.0 - smoothstep(0.0, 1.0, dist);

          gl_FragColor = vec4(uColor, alpha * uOpacity * vOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [size, opacity, color]);

  return <points geometry={geometry} material={material} />;
}

function DistantLights() {
  const { main, upper, beacons } = FLOAT_OUTSIDE.distantLights;

  return (
    <group name="distant-lights">
      {/* メインライト（水平線付近） */}
      <LightLayer config={main} />
      {/* 上空の光（極少） */}
      <LightLayer config={upper} />
      {/* ビーコン（大きめ、数個） */}
      <LightLayer config={beacons} />
    </group>
  );
}

// ============================================================
// 水平線のグロウ
// ============================================================

function HorizonGlow() {
  const { y, radius, width, opacity, color } = FLOAT_OUTSIDE.horizonGlow;

  if (!FLOAT_OUTSIDE.horizonGlow.enabled) return null;

  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - width / 2, radius + width / 2, 64]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ============================================================
// メインコンポーネント
// ============================================================

export default function FloatOutsideWorld(): React.JSX.Element {
  const { scene } = useThree();

  // シーン設定（背景色・フォグ）
  useEffect(() => {
    scene.background = new THREE.Color(FLOAT_OUTSIDE.background.color);
    scene.fog = new THREE.Fog(
      FLOAT_OUTSIDE.fog.color,
      FLOAT_OUTSIDE.fog.near,
      FLOAT_OUTSIDE.fog.far
    );
  }, [scene]);

  const { baseY, size, layers } = FLOAT_OUTSIDE.clouds;

  return (
    <group name="outside-world">
      {/* 雲海レイヤー */}
      {layers.map((layer, i) => (
        <CloudLayer
          key={`cloud-${i}`}
          y={baseY + layer.yOffset}
          opacity={layer.opacity}
          speed={layer.speed}
          scale={layer.scale}
          color={layer.color}
          size={size}
        />
      ))}

      {/* 遠景の光 */}
      <DistantLights />

      {/* 水平線グロウ */}
      <HorizonGlow />
    </group>
  );
}
