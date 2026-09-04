'use client';

import { useRef, forwardRef, useImperativeHandle, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { a as aWeb, useSpring } from '@react-spring/web';

type ArtworkLabelProps = {
  // 作品の親group基準のワールド座標・回転
  position?: [number, number, number];
  rotation?: [number, number, number];

  // 幅/高さベースのオフセット計算用
  width?: number;
  height?: number;

  // 直接指定したい場合
  labelOffset?: [number, number, number];

  // 表示距離（内側:7 / 外壁:9.5 など）
  nearDistance?: number;

  avatarRef: React.RefObject<THREE.Group>;
  title?: string;
  author?: string;
};

// 定数
const DEFAULT_NEAR_DISTANCE = 7;

const ArtworkLabel = forwardRef<THREE.Group, ArtworkLabelProps>(
  (
    {
      position = [0, 2, 0],
      rotation = [0, 0, 0],
      width = 2.5,
      height = 2,
      labelOffset,
      nearDistance = DEFAULT_NEAR_DISTANCE,
      avatarRef,
      title = 'Untitled',
      author = 'Unknown',
    },
    ref
  ) => {
    const groupRef = useRef<THREE.Group>(null);
    const { gl } = useThree();

    // Html の portal
    const portalRef = useRef<HTMLElement>(null!);
    useEffect(() => {
      const parent = gl.domElement.parentNode as (HTMLElement | null);
      portalRef.current = parent ?? document.body;
    }, [gl]);

    useImperativeHandle(ref, () => groupRef.current!, []);

    // ラベルのローカルオフセット（親 group の原点 = 作品中心 からの相対位置）
    // 実際の作品サイズ: width=2.5*scale=4.5, height=4.5/aspect=3.75 → 半幅2.25, 半高1.875
    // 北壁(rotY=PI)では local -X = world +X = 視聴者の右、全壁で local -Y = 下
    const localOffset = useMemo<[number, number, number]>(() => {
      if (labelOffset) return labelOffset;
      return [-2.6, -2.2, 0];
    }, [labelOffset]);

    // useFrame 内で getWorldPosition を使うための作業用ベクトル（GC回避）
    const worldPosRef = useRef(new THREE.Vector3());

    const [{ scale, uiOpacity }, api] = useSpring(() => ({
      scale: 0.5,
      uiOpacity: 0,
      config: { mass: 1, tension: 220, friction: 22 },
    }));

    useFrame(({ camera }) => {
      const avatar = avatarRef.current;
      const group = groupRef.current;
      if (!avatar || !group) return;

      // group のワールド座標を取得してアバターとの距離を計算
      group.getWorldPosition(worldPosRef.current);
      const dist = avatar.position.distanceTo(worldPosRef.current);
      const near = dist < nearDistance;

      api.start({
        scale: near ? 1 : 0.5,
        uiOpacity: near ? 1 : 0,
      });

      const s = scale.get();
      group.scale.set(s, s, s);
      group.lookAt(camera.position);
    });

    return (
      <group ref={groupRef} position={localOffset}>
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
      </group>
    );
  }
);

ArtworkLabel.displayName = 'ArtworkLabel';
export default ArtworkLabel;
