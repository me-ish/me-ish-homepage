/**
 * Float ギャラリー共有ジオメトリ・マテリアル
 *
 * 美術館建築デザイン（ダーク・コンテンポラリー）
 *
 * 同一のジオメトリ/マテリアルを再利用することで
 * GPU メモリ使用量を削減し、描画コールを最適化
 */

import * as THREE from 'three';
import { FLOAT_PANELS } from './floatPanels.constants';

// ============================================================
// 基本定数
// ============================================================

export const WALL_HEIGHT = 12; // 天井高を下げて人間スケールに
export const WALL_LENGTH = 35;
export const WALL_THICKNESS = 0.4;
export const FLOOR_SIZE = 80;
export const GALLERY_EDGE = 40; // ギャラリーの端

// ============================================================
// 壁ジオメトリ
// ============================================================

let _wallGeometryH: THREE.BoxGeometry | null = null;
export function getWallGeometryH(): THREE.BoxGeometry {
  if (!_wallGeometryH) {
    _wallGeometryH = new THREE.BoxGeometry(WALL_LENGTH, WALL_HEIGHT, WALL_THICKNESS);
  }
  return _wallGeometryH;
}

let _wallGeometryV: THREE.BoxGeometry | null = null;
export function getWallGeometryV(): THREE.BoxGeometry {
  if (!_wallGeometryV) {
    _wallGeometryV = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, WALL_LENGTH);
  }
  return _wallGeometryV;
}

// ============================================================
// 床ジオメトリ
// ============================================================

let _floorGeometry: THREE.PlaneGeometry | null = null;
export function getFloorGeometry(): THREE.PlaneGeometry {
  if (!_floorGeometry) {
    _floorGeometry = new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE);
  }
  return _floorGeometry;
}

// 中央円形アクセント
let _floorAccentGeometry: THREE.RingGeometry | null = null;
export function getFloorAccentGeometry(): THREE.RingGeometry {
  if (!_floorAccentGeometry) {
    _floorAccentGeometry = new THREE.RingGeometry(18, 22, 64);
  }
  return _floorAccentGeometry;
}

// ============================================================
// 天井ジオメトリ
// ============================================================

let _ceilingGeometry: THREE.PlaneGeometry | null = null;
export function getCeilingGeometry(): THREE.PlaneGeometry {
  if (!_ceilingGeometry) {
    _ceilingGeometry = new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE);
  }
  return _ceilingGeometry;
}

// トラックレール（壁に沿って走る照明レール）
const TRACK_LENGTH = 70;
const TRACK_WIDTH = 0.3;
const TRACK_HEIGHT = 0.15;

let _trackRailGeometry: THREE.BoxGeometry | null = null;
export function getTrackRailGeometry(): THREE.BoxGeometry {
  if (!_trackRailGeometry) {
    _trackRailGeometry = new THREE.BoxGeometry(TRACK_LENGTH, TRACK_HEIGHT, TRACK_WIDTH);
  }
  return _trackRailGeometry;
}

// ============================================================
// ピラー（角柱）ジオメトリ
// ============================================================

const PILLAR_SIZE = 1.5;

let _pillarGeometry: THREE.BoxGeometry | null = null;
export function getPillarGeometry(): THREE.BoxGeometry {
  if (!_pillarGeometry) {
    _pillarGeometry = new THREE.BoxGeometry(PILLAR_SIZE, WALL_HEIGHT, PILLAR_SIZE);
  }
  return _pillarGeometry;
}

// ============================================================
// アーチフレーム（開口部の枠）ジオメトリ
// ============================================================

const ARCH_WIDTH = 10; // 開口幅
const ARCH_FRAME_THICKNESS = 0.8;
const ARCH_FRAME_DEPTH = WALL_THICKNESS + 0.2;

// アーチ上部（横梁）
let _archTopGeometry: THREE.BoxGeometry | null = null;
export function getArchTopGeometry(): THREE.BoxGeometry {
  if (!_archTopGeometry) {
    _archTopGeometry = new THREE.BoxGeometry(ARCH_WIDTH + ARCH_FRAME_THICKNESS * 2, ARCH_FRAME_THICKNESS, ARCH_FRAME_DEPTH);
  }
  return _archTopGeometry;
}

// アーチ側面（縦枠）
let _archSideGeometry: THREE.BoxGeometry | null = null;
export function getArchSideGeometry(): THREE.BoxGeometry {
  if (!_archSideGeometry) {
    _archSideGeometry = new THREE.BoxGeometry(ARCH_FRAME_THICKNESS, WALL_HEIGHT - ARCH_FRAME_THICKNESS, ARCH_FRAME_DEPTH);
  }
  return _archSideGeometry;
}

// ============================================================
// ガラスパネル（開口部を塞ぐフロストガラス）ジオメトリ
// ============================================================

export const GLASS_PANEL_WIDTH = ARCH_WIDTH; // 開口幅と同じ
export const GLASS_PANEL_HEIGHT = WALL_HEIGHT;
const GLASS_PANEL_THICKNESS = 0.05;

let _glassPanelGeometry: THREE.BoxGeometry | null = null;
export function getGlassPanelGeometry(): THREE.BoxGeometry {
  if (!_glassPanelGeometry) {
    _glassPanelGeometry = new THREE.BoxGeometry(GLASS_PANEL_WIDTH, GLASS_PANEL_HEIGHT, GLASS_PANEL_THICKNESS);
  }
  return _glassPanelGeometry;
}

// ============================================================
// コーニス（廻り縁）ジオメトリ
// ============================================================

const CORNICE_HEIGHT = 0.4;
const CORNICE_DEPTH = 0.25;

let _corniceGeometryH: THREE.BoxGeometry | null = null;
export function getCorniceGeometryH(): THREE.BoxGeometry {
  if (!_corniceGeometryH) {
    _corniceGeometryH = new THREE.BoxGeometry(WALL_LENGTH, CORNICE_HEIGHT, CORNICE_DEPTH);
  }
  return _corniceGeometryH;
}

let _corniceGeometryV: THREE.BoxGeometry | null = null;
export function getCorniceGeometryV(): THREE.BoxGeometry {
  if (!_corniceGeometryV) {
    _corniceGeometryV = new THREE.BoxGeometry(CORNICE_DEPTH, CORNICE_HEIGHT, WALL_LENGTH);
  }
  return _corniceGeometryV;
}

// ============================================================
// 巾木ジオメトリ
// ============================================================

const BASEBOARD_HEIGHT = 0.25;
const BASEBOARD_DEPTH = 0.1;

let _baseboardGeometryH: THREE.BoxGeometry | null = null;
export function getBaseboardGeometryH(): THREE.BoxGeometry {
  if (!_baseboardGeometryH) {
    _baseboardGeometryH = new THREE.BoxGeometry(WALL_LENGTH, BASEBOARD_HEIGHT, WALL_THICKNESS + BASEBOARD_DEPTH);
  }
  return _baseboardGeometryH;
}

let _baseboardGeometryV: THREE.BoxGeometry | null = null;
export function getBaseboardGeometryV(): THREE.BoxGeometry {
  if (!_baseboardGeometryV) {
    _baseboardGeometryV = new THREE.BoxGeometry(WALL_THICKNESS + BASEBOARD_DEPTH, BASEBOARD_HEIGHT, WALL_LENGTH);
  }
  return _baseboardGeometryV;
}

// ============================================================
// 中央パネルジオメトリ（constants に統一）
// ============================================================

let _panelGeometry: THREE.BoxGeometry | null = null;
export function getPanelGeometry(): THREE.BoxGeometry {
  if (!_panelGeometry) {
    _panelGeometry = new THREE.BoxGeometry(
      FLOAT_PANELS.width,
      FLOAT_PANELS.height,
      FLOAT_PANELS.thickness
    );
  }
  return _panelGeometry;
}

// ============================================================
// 共有マテリアル（ダーク・コンテンポラリー）
// ============================================================

// 壁マテリアル - ミディアムグレー（上品なマット）
let _wallMaterial: THREE.MeshStandardMaterial | null = null;
export function getWallMaterial(): THREE.MeshStandardMaterial {
  if (!_wallMaterial) {
    _wallMaterial = new THREE.MeshStandardMaterial({
      color: '#4a4a4a',
      roughness: 0.9,
      metalness: 0.02,
    });
  }
  return _wallMaterial;
}

// 床マテリアル - 磨かれたコンクリート風
let _floorMaterial: THREE.MeshStandardMaterial | null = null;
export function getFloorMaterial(): THREE.MeshStandardMaterial {
  if (!_floorMaterial) {
    _floorMaterial = new THREE.MeshStandardMaterial({
      color: '#3a3a3a',
      roughness: 0.6,
      metalness: 0.12,
    });
  }
  return _floorMaterial;
}

// 床アクセントマテリアル - わずかに明るいライン
let _floorAccentMaterial: THREE.MeshStandardMaterial | null = null;
export function getFloorAccentMaterial(): THREE.MeshStandardMaterial {
  if (!_floorAccentMaterial) {
    _floorAccentMaterial = new THREE.MeshStandardMaterial({
      color: '#4a4a4a',
      roughness: 0.5,
      metalness: 0.2,
    });
  }
  return _floorAccentMaterial;
}

// 天井マテリアル - マットブラック
let _ceilingMaterial: THREE.MeshStandardMaterial | null = null;
export function getCeilingMaterial(): THREE.MeshStandardMaterial {
  if (!_ceilingMaterial) {
    _ceilingMaterial = new THREE.MeshStandardMaterial({
      color: '#1a1a1a',
      roughness: 0.95,
      metalness: 0.0,
    });
  }
  return _ceilingMaterial;
}

// トラックレールマテリアル - マットブラック金属
let _trackRailMaterial: THREE.MeshStandardMaterial | null = null;
export function getTrackRailMaterial(): THREE.MeshStandardMaterial {
  if (!_trackRailMaterial) {
    _trackRailMaterial = new THREE.MeshStandardMaterial({
      color: '#1f1f1f',
      roughness: 0.7,
      metalness: 0.3,
    });
  }
  return _trackRailMaterial;
}

// ピラーマテリアル - 壁より少し明るい
let _pillarMaterial: THREE.MeshStandardMaterial | null = null;
export function getPillarMaterial(): THREE.MeshStandardMaterial {
  if (!_pillarMaterial) {
    _pillarMaterial = new THREE.MeshStandardMaterial({
      color: '#454545',
      roughness: 0.85,
      metalness: 0.05,
    });
  }
  return _pillarMaterial;
}

// アーチフレームマテリアル - コントラストのためやや明るめ
let _archMaterial: THREE.MeshStandardMaterial | null = null;
export function getArchMaterial(): THREE.MeshStandardMaterial {
  if (!_archMaterial) {
    _archMaterial = new THREE.MeshStandardMaterial({
      color: '#505050',
      roughness: 0.8,
      metalness: 0.1,
    });
  }
  return _archMaterial;
}

// ガラスパネルマテリアル - フロストガラス風（半透明）
let _glassMaterial: THREE.MeshPhysicalMaterial | null = null;
export function getGlassMaterial(): THREE.MeshPhysicalMaterial {
  if (!_glassMaterial) {
    _glassMaterial = new THREE.MeshPhysicalMaterial({
      color: '#e8eef5',
      transparent: true,
      opacity: 0.4,
      roughness: 0.15,
      metalness: 0.0,
      transmission: 0.6,       // 光の透過
      thickness: 0.5,          // ガラスの厚み感
      envMapIntensity: 0.5,
    });
  }
  return _glassMaterial;
}

// コーニスマテリアル - 壁と同系色
let _corniceMaterial: THREE.MeshStandardMaterial | null = null;
export function getCorniceMaterial(): THREE.MeshStandardMaterial {
  if (!_corniceMaterial) {
    _corniceMaterial = new THREE.MeshStandardMaterial({
      color: '#424242',
      roughness: 0.85,
      metalness: 0.05,
    });
  }
  return _corniceMaterial;
}

// 巾木マテリアル - 床に近い暗さ
let _baseboardMaterial: THREE.MeshStandardMaterial | null = null;
export function getBaseboardMaterial(): THREE.MeshStandardMaterial {
  if (!_baseboardMaterial) {
    _baseboardMaterial = new THREE.MeshStandardMaterial({
      color: '#252525',
      roughness: 0.8,
      metalness: 0.1,
    });
  }
  return _baseboardMaterial;
}

// パネルマテリアル - 濃いチャコール
let _panelMaterial: THREE.MeshStandardMaterial | null = null;
export function getPanelMaterial(): THREE.MeshStandardMaterial {
  if (!_panelMaterial) {
    _panelMaterial = new THREE.MeshStandardMaterial({
      color: '#2d2d35',
      roughness: 0.88,
      metalness: 0.04,
    });
  }
  return _panelMaterial;
}

// ============================================================
// クリーンアップ
// ============================================================

export function disposeSharedResources(): void {
  const geometries = [
    _wallGeometryH, _wallGeometryV, _floorGeometry, _floorAccentGeometry,
    _ceilingGeometry, _trackRailGeometry, _pillarGeometry,
    _archTopGeometry, _archSideGeometry, _glassPanelGeometry,
    _corniceGeometryH, _corniceGeometryV,
    _baseboardGeometryH, _baseboardGeometryV, _panelGeometry,
  ];

  const materials = [
    _wallMaterial, _floorMaterial, _floorAccentMaterial, _ceilingMaterial,
    _trackRailMaterial, _pillarMaterial, _archMaterial, _glassMaterial,
    _corniceMaterial, _baseboardMaterial, _panelMaterial,
  ];

  geometries.forEach(g => g?.dispose());
  materials.forEach(m => m?.dispose());

  _wallGeometryH = null;
  _wallGeometryV = null;
  _floorGeometry = null;
  _floorAccentGeometry = null;
  _ceilingGeometry = null;
  _trackRailGeometry = null;
  _pillarGeometry = null;
  _archTopGeometry = null;
  _archSideGeometry = null;
  _glassPanelGeometry = null;
  _corniceGeometryH = null;
  _corniceGeometryV = null;
  _baseboardGeometryH = null;
  _baseboardGeometryV = null;
  _panelGeometry = null;
  _wallMaterial = null;
  _floorMaterial = null;
  _floorAccentMaterial = null;
  _ceilingMaterial = null;
  _trackRailMaterial = null;
  _pillarMaterial = null;
  _archMaterial = null;
  _glassMaterial = null;
  _corniceMaterial = null;
  _baseboardMaterial = null;
  _panelMaterial = null;
}
