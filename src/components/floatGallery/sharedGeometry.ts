/**
 * Float ギャラリー共有ジオメトリ・マテリアル
 *
 * 同一のジオメトリ/マテリアルを再利用することで
 * GPU メモリ使用量を削減し、描画コールを最適化
 */

import * as THREE from 'three';

// ============================================================
// 壁・建築ジオメトリ
// ============================================================

// 壁のサイズ定数
export const WALL_HEIGHT = 20;
export const WALL_LENGTH = 35;
export const WALL_THICKNESS = 1.0;
export const FLOOR_SIZE = 80;

// 壁ジオメトリ（横向き）
let _wallGeometryH: THREE.BoxGeometry | null = null;
export function getWallGeometryH(): THREE.BoxGeometry {
  if (!_wallGeometryH) {
    _wallGeometryH = new THREE.BoxGeometry(WALL_LENGTH, WALL_HEIGHT, WALL_THICKNESS);
  }
  return _wallGeometryH;
}

// 壁ジオメトリ（縦向き）
let _wallGeometryV: THREE.BoxGeometry | null = null;
export function getWallGeometryV(): THREE.BoxGeometry {
  if (!_wallGeometryV) {
    _wallGeometryV = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, WALL_LENGTH);
  }
  return _wallGeometryV;
}

// 床ジオメトリ
let _floorGeometry: THREE.PlaneGeometry | null = null;
export function getFloorGeometry(): THREE.PlaneGeometry {
  if (!_floorGeometry) {
    _floorGeometry = new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE);
  }
  return _floorGeometry;
}

// 天井梁ジオメトリ
let _beamGeometry: THREE.BoxGeometry | null = null;
export function getBeamGeometry(): THREE.BoxGeometry {
  if (!_beamGeometry) {
    _beamGeometry = new THREE.BoxGeometry(7, 1, 80);
  }
  return _beamGeometry;
}

// 中央パネルジオメトリ
const PANEL_WIDTH = 18;
const PANEL_HEIGHT = 8;
const PANEL_THICKNESS = 1.0;

let _panelGeometry: THREE.BoxGeometry | null = null;
export function getPanelGeometry(): THREE.BoxGeometry {
  if (!_panelGeometry) {
    _panelGeometry = new THREE.BoxGeometry(PANEL_WIDTH, PANEL_HEIGHT, PANEL_THICKNESS);
  }
  return _panelGeometry;
}

// ============================================================
// 共有マテリアル
// ============================================================

// 壁マテリアル
let _wallMaterial: THREE.MeshStandardMaterial | null = null;
export function getWallMaterial(): THREE.MeshStandardMaterial {
  if (!_wallMaterial) {
    _wallMaterial = new THREE.MeshStandardMaterial({
      color: '#bbbbbb',
      roughness: 0.85,
      metalness: 0.05,
    });
  }
  return _wallMaterial;
}

// 床マテリアル
let _floorMaterial: THREE.MeshStandardMaterial | null = null;
export function getFloorMaterial(): THREE.MeshStandardMaterial {
  if (!_floorMaterial) {
    _floorMaterial = new THREE.MeshStandardMaterial({
      color: '#eaeaea',
    });
  }
  return _floorMaterial;
}

// 梁マテリアル（明るい）
let _beamMaterialLight: THREE.MeshStandardMaterial | null = null;
export function getBeamMaterialLight(): THREE.MeshStandardMaterial {
  if (!_beamMaterialLight) {
    _beamMaterialLight = new THREE.MeshStandardMaterial({
      color: '#cccccc',
    });
  }
  return _beamMaterialLight;
}

// 梁マテリアル（暗い）
let _beamMaterialDark: THREE.MeshStandardMaterial | null = null;
export function getBeamMaterialDark(): THREE.MeshStandardMaterial {
  if (!_beamMaterialDark) {
    _beamMaterialDark = new THREE.MeshStandardMaterial({
      color: '#666666',
    });
  }
  return _beamMaterialDark;
}

// パネルマテリアル
let _panelMaterial: THREE.MeshStandardMaterial | null = null;
export function getPanelMaterial(): THREE.MeshStandardMaterial {
  if (!_panelMaterial) {
    _panelMaterial = new THREE.MeshStandardMaterial({
      color: '#cccccc',
      roughness: 0.85,
      metalness: 0.05,
    });
  }
  return _panelMaterial;
}

// ============================================================
// クリーンアップ（必要に応じて）
// ============================================================

export function disposeSharedResources(): void {
  _wallGeometryH?.dispose();
  _wallGeometryV?.dispose();
  _floorGeometry?.dispose();
  _beamGeometry?.dispose();
  _panelGeometry?.dispose();
  _wallMaterial?.dispose();
  _floorMaterial?.dispose();
  _beamMaterialLight?.dispose();
  _beamMaterialDark?.dispose();
  _panelMaterial?.dispose();

  _wallGeometryH = null;
  _wallGeometryV = null;
  _floorGeometry = null;
  _beamGeometry = null;
  _panelGeometry = null;
  _wallMaterial = null;
  _floorMaterial = null;
  _beamMaterialLight = null;
  _beamMaterialDark = null;
  _panelMaterial = null;
}
