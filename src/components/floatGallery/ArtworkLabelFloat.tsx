'use client';

import { useRef, forwardRef, useImperativeHandle, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { a as aWeb, useSpring } from '@react-spring/web';
import { a } from '@react-spring/three';

type ArtworkLabelProps = {
  // 作品の親group基準のワールド座標・回転（親側がposition/rotationを持つ想定でもOK）
  position?: [number, number, number];
  rotation?: [number, number, number];

  // 既存の幅/高さベースのオフセット計算（未指定なら下のlabelOffsetより優先度低）
  width?: number;   // 例: scale*aspect
  height?: number;  // 例: scale

  // 推奨: スケールに応じて直接指定したい場合はこちら
  labelOffset?: [number, number, number]; // 例: [W/2-0.35k, -H/2-0.2k, -0.7k]

  // 表示距離（内側:7 / 外壁:9.5 など）
  nearDistance?: number;

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
      labelOffset,
      nearDistance = 7,
      avatarRef,
      title = 'Untitled',
      author = 'Unknown',
    },
    ref
  ) => {
    const groupRef = useRef<THREE.Group>(null);
    const auraRef = useRef<THREE.Mesh>(null);
    const { gl } = useThree();

    // Html の portal は null 不可の MutableRefObject<HTMLElement> が必要
    const portalRef = useRef<HTMLElement>(null!);
    useEffect(() => {
      const parent = gl.domElement.parentNode as (HTMLElement | null);
      portalRef.current = parent ?? document.body;
    }, [gl]);

    useImperativeHandle(ref, () => groupRef.current!, []);

    // ラベルの“ローカル”オフセット（右下・内側）
    const localOffset = useMemo(() => {
      if (labelOffset) return new THREE.Vector3(...labelOffset);
      // 既存の挙動：幅/高さベース（右下寄せ、内側はz=0のまま）
      return new THREE.Vector3(width / 3 - 3.5, -height / 3 - 0.2, 0);
    }, [labelOffset, width, height]);

    // 親の回転に合わせてオフセットを回す
    const rotatedOffset = useMemo(() => {
      const v = localOffset.clone();
      v.applyEuler(new THREE.Euler(...rotation));
      return v;
    }, [localOffset, rotation]);

    const labelPos: [number, number, number] = [
      position[0] + rotatedOffset.x,
      position[1] + rotatedOffset.y,
      position[2] + rotatedOffset.z,
    ];

    const [{ scale, uiOpacity }, api] = useSpring(() => ({
      scale: 0.5,
      uiOpacity: 0,
      config: { mass: 1, tension: 220, friction: 22 },
    }));

    useFrame(({ camera, clock }) => {
      const avatar = avatarRef.current;
      const group = groupRef.current;
      if (!avatar || !group) return;

      const dist = avatar.position.distanceTo(new THREE.Vector3(...labelPos));
      const near = dist < nearDistance;

      api.start({
        scale: near ? 1 : 0.5,
        uiOpacity: near ? 1 : 0,
      });

      group.lookAt(camera.position);

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

        <Html
          center
          transform
          wrapperClass="artwork-label-wrapper"
          zIndexRange={[10, 0]}
          portal={portalRef}
        >
          <aWeb.div
            // SpringValue を含むため any キャストで型を回避
            style={
              {
                opacity: uiOpacity,
                background: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(0, 0, 0, 0.06)',
                borderRadius: '10px',
                padding: '8px 12px',
                boxShadow: '0 4px 18px rgba(16, 24, 40, 0.12)',
                color: '#111',
                fontWeight: 600,
                textAlign: 'center',
                minWidth: '72px',
                fontSize: '13px',
                lineHeight: 1.35,
              } as any
            }
          >
            <div style={{ whiteSpace: 'nowrap' }}>{title}</div>
            {author && (
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8, color: '#444' }}>
                by {author}
              </div>
            )}
          </aWeb.div>
        </Html>
      </a.group>
    );
  }
);

ArtworkLabel.displayName = 'ArtworkLabel';
export default ArtworkLabel;
