'use client';

import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from 'three';
import * as THREE from 'three';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { a as a3, useSpring } from '@react-spring/three';
import { animated } from '@react-spring/web';
import { Html, useTexture } from '@react-three/drei';
import React from 'react';

interface CoreSphereProps {
  avatarRef: React.RefObject<THREE.Object3D>;
}

const CoreSphere: React.FC<CoreSphereProps> = ({ avatarRef }) => {
  const plasticMap = useTexture('/textures/Plastic008_BaseColor.jpg');
  const tilesMap = useTexture('/textures/Tiles044_BaseColor.jpg');

  const outerRef = useRef<THREE.Mesh>(null);
  const router = useRouter();

  const [selected, setSelected] = useState<'white' | 'float' | null>(null);
  const [showUI, setShowUI] = useState(false);

  const { opacity, emissiveIntensity, uiOpacity } = useSpring({
    opacity: selected ? 0 : 0.7,
    emissiveIntensity: selected ? 2.5 : 0.4,
    uiOpacity: showUI ? 1 : 0,
    config: { tension: 80, friction: 26 },
    onRest: () => {
      if (selected) {
        setTimeout(() => {
          if (selected === 'white') router.push('/white');
          if (selected === 'float') router.push('/float');
        }, 300);
      }
    },
  });

  useFrame(() => {
    if (outerRef.current) {
      outerRef.current.rotation.y += 0.005;
    }

    const avatarPos = avatarRef?.current?.position;
    if (avatarPos && 'distanceTo' in avatarPos) {
      const dist = avatarPos.distanceTo(new THREE.Vector3(0, 5, 0));
      setShowUI(dist < 6);
    }
  });

  const buttonStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #00ffff 0%, #007fff 100%)',
    border: 'none',
    color: 'white',
    fontWeight: 'bold',
    borderRadius: '8px',
    padding: '10px 20px',
    cursor: 'pointer',
    boxShadow: '0 0 12px #00eaff88',
    transition: 'transform 0.2s, box-shadow 0.2s',
    fontSize: '0.9rem',
  };

  const hoverIn = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1.05)';
    e.currentTarget.style.boxShadow = '0 0 20px #00ffffcc';
  };

  const hoverOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.boxShadow = '0 0 12px #00eaff88';
  };

  return (
    <group position={[0, 5, 0]}>
      {showUI && !selected && (
        <Html position={[1.2, 0, 0]} distanceFactor={10}>
          <animated.div
            style={{
              opacity: uiOpacity.to((o) => o),
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(0, 255, 255, 0.4)',
              borderRadius: '16px',
              padding: '20px 24px',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 0 30px rgba(0, 255, 255, 0.4)',
              color: '#00ffff',
              fontWeight: 'bold',
              textAlign: 'center',
              minWidth: '180px',
            }}
          >
            <p style={{ fontSize: '1.0em', marginBottom: '14px' }}>Select Destination</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => setSelected('white')}
                style={buttonStyle}
                onMouseOver={hoverIn}
                onMouseOut={hoverOut}
              >
                White Gallery
              </button>
              <button
                onClick={() => setSelected('float')}
                style={buttonStyle}
                onMouseOver={hoverIn}
                onMouseOut={hoverOut}
              >
                Float Gallery
              </button>
            </div>
          </animated.div>
        </Html>
      )}

      {/* 内側の発光コア */}
      <a3.mesh>
        <sphereGeometry args={[0.4, 64, 64]} />
        {/* @ts-ignore */}
        <a3.meshStandardMaterial
          map={plasticMap}
          color="#88ccff"
          metalness={0.2}
          roughness={0.4}
          emissive="#88ccff"
          emissiveIntensity={emissiveIntensity}
          toneMapped={false}
          transparent
          attach="material"
        />
      </a3.mesh>

      {/* 外側リング（回転＋光エフェクト） */}
      <a3.mesh ref={outerRef}>
        <sphereGeometry args={[0.75, 64, 64]} />
        <a3.meshBasicMaterial
          map={tilesMap}
          color="#00ffff"
          transparent
          opacity={opacity}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </a3.mesh>
    </group>
  );
};

export default CoreSphere;


