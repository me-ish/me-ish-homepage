'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * ForestExhibitPanels - 森の中の展示パネル配置
 *
 * 30枚のパネルを回遊できる配置で設置。
 * Instancedで描画を最適化。
 */

// パネル設定
const PANEL_WIDTH = 2.5;
const PANEL_HEIGHT = 3.5;
const PANEL_DEPTH = 0.08;
const PANEL_COUNT = 30;

// 配置設定
const INNER_RADIUS = 8;
const OUTER_RADIUS = 45;
const HEIGHT_BASE = 1.8; // パネル中心のY位置

// パネル色
const PANEL_COLOR = '#2a2a2a';
const FRAME_COLOR = '#1a1a1a';

// ダミーデータ（将来的に外部データに置き換え）
type ExhibitData = {
  id: string;
  title: string;
  artist: string;
  color: string; // ダミー用の色
};

const DUMMY_EXHIBITS: ExhibitData[] = Array.from({ length: PANEL_COUNT }, (_, i) => ({
  id: `exhibit-${i + 1}`,
  title: `作品 ${i + 1}`,
  artist: `アーティスト ${(i % 5) + 1}`,
  color: `hsl(${(i * 37) % 360}, 40%, 35%)`,
}));

// パネル配置を生成（螺旋状 + ランダム散らし）
function generatePanelPositions(): { position: THREE.Vector3; rotation: number }[] {
  const positions: { position: THREE.Vector3; rotation: number }[] = [];

  for (let i = 0; i < PANEL_COUNT; i++) {
    // 螺旋状に配置
    const t = i / PANEL_COUNT;
    const radius = INNER_RADIUS + t * (OUTER_RADIUS - INNER_RADIUS);
    const angle = t * Math.PI * 6 + (Math.random() - 0.5) * 0.5; // 3周 + ランダム

    // 少しランダムにずらす
    const x = Math.cos(angle) * radius + (Math.random() - 0.5) * 3;
    const z = Math.sin(angle) * radius + (Math.random() - 0.5) * 3;
    const y = HEIGHT_BASE + (Math.random() - 0.5) * 0.3;

    // 中心を向くように回転（+ ランダムな揺らぎ）
    const rotationY = -angle + Math.PI + (Math.random() - 0.5) * 0.3;

    positions.push({
      position: new THREE.Vector3(x, y, z),
      rotation: rotationY,
    });
  }

  return positions;
}

// 距離判定フック（将来のラベル表示用）
export function useNearestPanel(
  panelPositions: THREE.Vector3[],
  threshold: number = 5
): { nearestIndex: number | null; distance: number } {
  const { camera } = useThree();
  const result = useRef<{ nearestIndex: number | null; distance: number }>({
    nearestIndex: null,
    distance: Infinity,
  });

  useFrame(() => {
    let minDist = Infinity;
    let nearestIdx: number | null = null;

    for (let i = 0; i < panelPositions.length; i++) {
      const dist = camera.position.distanceTo(panelPositions[i]);
      if (dist < minDist && dist < threshold) {
        minDist = dist;
        nearestIdx = i;
      }
    }

    result.current.nearestIndex = nearestIdx;
    result.current.distance = minDist;
  });

  return result.current;
}

export default function ForestExhibitPanels(): React.JSX.Element {
  const panelData = useMemo(() => generatePanelPositions(), []);

  // パネルジオメトリ（共有）
  const panelGeometry = useMemo(() => {
    return new THREE.BoxGeometry(PANEL_WIDTH, PANEL_HEIGHT, PANEL_DEPTH);
  }, []);

  // フレームジオメトリ（共有）
  const frameGeometry = useMemo(() => {
    const frameWidth = PANEL_WIDTH + 0.15;
    const frameHeight = PANEL_HEIGHT + 0.15;
    return new THREE.BoxGeometry(frameWidth, frameHeight, PANEL_DEPTH * 0.5);
  }, []);

  // マテリアル（共有）
  const panelMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: PANEL_COLOR,
      roughness: 0.3,
      metalness: 0.1,
    });
  }, []);

  const frameMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: FRAME_COLOR,
      roughness: 0.5,
      metalness: 0.2,
    });
  }, []);

  return (
    <group name="forest-exhibit-panels">
      {panelData.map((panel, index) => {
        const exhibit = DUMMY_EXHIBITS[index];

        return (
          <group
            key={exhibit.id}
            position={panel.position}
            rotation={[0, panel.rotation, 0]}
          >
            {/* フレーム（背面） */}
            <mesh
              geometry={frameGeometry}
              material={frameMaterial}
              position={[0, 0, -PANEL_DEPTH * 0.5]}
            />

            {/* パネル本体 */}
            <mesh geometry={panelGeometry} material={panelMaterial} />

            {/* ダミーアートワーク（色付きプレーン） */}
            <mesh position={[0, 0, PANEL_DEPTH / 2 + 0.001]}>
              <planeGeometry args={[PANEL_WIDTH * 0.85, PANEL_HEIGHT * 0.85]} />
              <meshBasicMaterial color={exhibit.color} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// パネル位置をエクスポート（ラベル表示などで使用）
export function getExhibitData() {
  return {
    positions: generatePanelPositions().map((p) => p.position),
    exhibits: DUMMY_EXHIBITS,
  };
}
