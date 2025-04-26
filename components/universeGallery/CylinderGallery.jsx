// components/GalleryWallsGradient.jsx
import { useRef } from 'react'

export default function GalleryWallsGradient() {
  return (
    <mesh position={[0, 2.5, 0]}>
      <cylinderGeometry args={[10, 10, 5, 64, 1, true]} />
      <shaderMaterial
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;

          void main() {
            // カラーパレット（下と上の色）
            vec3 bottomColor = vec3(0.03, 0.04, 0.07);  // 深い青系
            vec3 topColor = vec3(0.14, 0.16, 0.22);     // 紫がかったグレー

            // ==== 黒潰れ防止！ ====
            float y = clamp(vUv.y, 0.05, 1.0);          // 下限補正
            float gradStrength = pow(y, 1.8);           // 非線形でグラデ強調

            vec3 color = mix(bottomColor, topColor, gradStrength);
            gl_FragColor = vec4(color, 0.95);           // わずかに透過
          }
        `}
        side={2} // DoubleSide
        transparent
      />
    </mesh>
  )
}
