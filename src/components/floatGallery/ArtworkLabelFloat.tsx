'use client';

import { useRef, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { a as aWeb, useSpring } from '@react-spring/web';
import { a } from '@react-spring/three';
import { SpringValue } from '@react-spring/web';

type ArtworkLabelProps = {
  position?: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
  avatarRef: React.RefObject<THREE.Group>;
  title?: string;
  author?: string;
};

const ArtworkLabel = forwardRef<THREE.Group, ArtworkLabelProps>(
  (
    {
      position = [0, 2, 0],
      rotation = [0, 0, 0],
      width = 2.5,
      height = 2,
      avatarRef,
      title = 'Untitled',
      author = 'Unknown',
    },
    ref
  ) => {
    const groupRef = useRef<THREE.Group>(null);
    const auraRef = useRef<THREE.Mesh>(null);

    useImperativeHandle(ref, () => groupRef.current!, []);

    const offset = new THREE.Vector3(width / 3 - 3.5, -height / 3 - 0.2, 0);
    offset.applyEuler(new THREE.Euler(...rotation));
    const labelPos: [number, number, number] = [
      position[0] + offset.x,
      position[1] + offset.y,
      position[2] + offset.z,
    ];

    const [{ opacity, scale, uiOpacity }, api] = useSpring(() => ({
      opacity: 0,
      scale: 0.5,
      uiOpacity: 0,
      config: { mass: 1, tension: 220, friction: 22 },
    }));

    useFrame(({ camera, clock }) => {
      if (!avatarRef.current || !groupRef.current) return;

      const dist = avatarRef.current.position.distanceTo(new THREE.Vector3(...labelPos));
      const near = dist < 7;

      api.start({
        opacity: near ? 1 : 0,
        scale: near ? 1 : 0.5,
        uiOpacity: near ? 1 : 0,
      });

      groupRef.current.lookAt(camera.position);

      if (auraRef.current) {
        const t = clock.getElapsedTime();
        const s = 1 + Math.sin(t * 3) * 0.05;
        auraRef.current.scale.set(s, s, s);
        const mat = auraRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.12 + Math.sin(t * 2) * 0.04;
      }
    });

    return (
      <a.group
        ref={groupRef}
        position={labelPos}
        scale={scale.to((s) => [s, s, s])}
      >
        <mesh ref={auraRef}>
          <circleGeometry args={[1.2, 32]} />
          <meshBasicMaterial
            color="#00ffff"
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        <Html center transform wrapperClass="artwork-label-wrapper" zIndexRange={[10, 0]}>
          <aWeb.div
            style={
              {
                opacity: uiOpacity as SpringValue<number>,
                background: 'rgba(255, 255, 255, 0.25)',
                border: '1px solid rgba(0, 255, 255, 0.4)',
                borderRadius: '10px',
                padding: '8px 12px',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 0 12px rgba(0, 255, 255, 0.3)',
                color: '#111',
                fontWeight: '600',
                textAlign: 'center',
                minWidth: '60px',
                fontSize: '13px',
                lineHeight: '1.3',
                textShadow: '0 0 2px rgba(255,255,255,0.2)',
              } as any
            }
          >
            <div>{title}</div>
            <div
              style={{
                fontSize: '11px',
                marginTop: '4px',
                opacity: 0.85,
                color: '#333',
                textShadow: '0 0 1px rgba(255,255,255,0.1)',
              }}
            >
              by {author}
            </div>
          </aWeb.div>
        </Html>
      </a.group>
    );
  }
);

export default ArtworkLabel;
