# Concrete Gallery v2 — 構造仕様書

## 概要

Dia:Beacon風の巨大コンクリートギャラリー + 安藤忠雄の光スリット + 中庭水盤。
一階建て、出入口なし（Web3D空間専用）。左右対称のコの字型仕切り壁。作品40点（2m×1.5m大型）。

**参考**: Dia:Beacon (巨大倉庫・天井高い) + 安藤忠雄 (光のスリット・コンクリート) + 中庭水盤

## 座標系

- **Blender**: Y-forward, Z-up
- **Three.js / R3F**: Y-up, Z-forward
- **変換**: `[blender_x, blender_z, -blender_y]` or `<group rotation-x={-Math.PI/2}>`

## 建物外殻

```
幅(X): 60m  |  奥行(Y): 40m  |  天井高: 8m  |  壁厚: 0.4m
```

| 壁       | position            | size             |
|----------|---------------------|------------------|
| Back     | (0, -19.8, 4)       | (60, 0.4, 8)    |
| Front    | (0, 19.8, 4)        | (60, 0.4, 8)    |
| Left     | (-29.8, 0, 4)       | (0.4, 40, 8)    |
| Right    | (29.8, 0, 4)        | (0.4, 40, 8)    |

## 中庭 (Courtyard)

中央やや手前に 8m×8m のガラス囲い中庭。天井が抜けて空が見える。
中に浅い水盤（水深5cm）。見えるけど入れない = 閉塞感の緩和。

- 位置: center (0, 3)
- ガラス壁4面 (厚さ0.05m, 透過率85%)
- 水盤: 7.8m×7.8m, Z=0.05
- 天井は中庭上部が開口（4分割パネル）

## 仕切り壁（コの字 × 2）

高さ **6.5m**（天井8mとの間に **1.5mの光スリット空間**）。

```
平面図:

  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │     ┌────────────┐                ┌────────────┐         │  Y=12 (top arm)
  │     │            │                │            │         │
  │     │            │                │            │         │
  │     │    left    │   ┌────────┐   │   right    │         │
  │     │     U      │   │courtyard│  │     U      │         │  center (0,3)
  │     │            │   │ water  │   │            │         │
  │     │            │   └────────┘   │            │         │
  │     │            │                │            │         │
  │     └────────────┘                └────────────┘         │  Y=-9 (bottom arm)
  │                                                          │
  └──────────────────────────────────────────────────────────┘

  X: -30        -22  -10           10  22          30
```

### 左コの字 (left_u)

| パーツ      | position          | size              |
|------------|-------------------|-------------------|
| Spine      | (-10, 1.5, 3.25)  | (0.35, 21, 6.5)  |
| Top Arm    | (-16, 12, 3.25)   | (12, 0.35, 6.5)  |
| Bottom Arm | (-16, -9, 3.25)   | (12, 0.35, 6.5)  |

- Spine: X=-10, Y=-9〜12
- Arms: X=-22〜-10

### 右コの字 (right_u) — 左の鏡像

| パーツ      | position          | size              |
|------------|-------------------|-------------------|
| Spine      | (10, 1.5, 3.25)   | (0.35, 21, 6.5)  |
| Top Arm    | (16, 12, 3.25)    | (12, 0.35, 6.5)  |
| Bottom Arm | (16, -9, 3.25)    | (12, 0.35, 6.5)  |

### 回遊動線の通路

- Spine上端(Y=12) ↔ Front壁(Y=19.6): **7.6m**
- Spine下端(Y=-9) ↔ Back壁(Y=-19.6): **10.6m**
- Arm外端(X=±22) ↔ 側壁(X=±29.6): **7.6m**
- 左右Spine間: **20m** (中庭を挟んで)

## 作品配置 (40点)

サイズ: **2m × 1.5m**（大型絵画）、フレーム深さ0.06m、枠幅0.05m
掛け高さ: 中心 Z=2.2m

### 外壁 (24点)

| 壁    | 点数 | facing | 間隔   | ID           |
|-------|------|--------|--------|-------------|
| Back  | 7    | +y     | 7.5m   | Art_01〜07  |
| Front | 7    | -y     | 7.5m   | Art_08〜14  |
| Left  | 5    | +x     | 7.0m   | Art_15〜19  |
| Right | 5    | -x     | 7.0m   | Art_20〜24  |

### コの字壁 (16点, Spineの両面のみ)

| 面                    | 点数 | facing | 間隔   | ID           |
|-----------------------|------|--------|--------|-------------|
| L Spine inner (+x)    | 4    | +x     | 5.5m   | Art_25〜28  |
| L Spine outer (-x)    | 4    | -x     | 5.5m   | Art_29〜32  |
| R Spine inner (-x)    | 4    | -x     | 5.5m   | Art_33〜36  |
| R Spine outer (+x)    | 4    | +x     | 5.5m   | Art_37〜40  |

## 光のスリット

### 仕切り壁上部スリット (高さ1.5m, Z=6.5〜8)
仕切り壁(H=6.5m)と天井(H=8m)の間の空間。emissiveパネルで表現。

| スリット        | position          | size              |
|----------------|-------------------|-------------------|
| UL Spine       | (-10, 1.5, 7.25)  | (0.05, 21, 1.3)  |
| UL Top Arm     | (-16, 12, 7.25)   | (12, 0.05, 1.3)  |
| UL Bottom Arm  | (-16, -9, 7.25)   | (12, 0.05, 1.3)  |
| UR (mirror)    | (同上の鏡像)       |                   |

### 外壁上部スリット (薄い光の帯, Z=7.7)

全外壁の天井接合部に幅15cmの発光帯。

## マテリアル

```jsx
// コンクリート壁 — Dia:Beacon industrial + Ando fair-faced
<meshStandardMaterial color="#9E9A91" roughness={0.82} metalness={0} />
// ノイズテクスチャ + ボロノイ型枠目地 + バンプマップ推奨

// 床 — 磨きコンクリート（Dia:Beacon の工場床風）
<meshStandardMaterial color="#6B6660" roughness={0.3} />

// フレーム — ダーク金属
<meshStandardMaterial color="#1F1F1F" roughness={0.25} metalness={0.85} />

// 光スリット — emissive
<meshStandardMaterial color="#F2F7FF" emissive="#F2F7FF" emissiveIntensity={5} />

// 水面
<meshStandardMaterial color="#263841" roughness={0.05} transparent opacity={0.6} />

// ガラス
<meshStandardMaterial color="#E5F0FF" roughness={0} transparent opacity={0.15} />
```

## ライティング

| タイプ        | 設定                                        |
|--------------|---------------------------------------------|
| Sun          | intensity 3.0, color #FFF9F0               |
| Area × 3    | X=-20/0/20, Z=7.8, 2×30m, intensity 800    |
| Spot × 40   | 各作品に1灯, 壁から2.5m, Z=7.5, 100W, 45°   |

## 家具

コンクリート製ロングベンチ4台:
- 中央回廊: (0, -4) と (0, 2) — 1.5×0.3m
- 側回廊: (-18, 0) と (18, 0) — 3×0.5m

## R3F実装

```jsx
import galleryData from './gallery_structure.json';

// 座標変換ユーティリティ
const toR3F = ([x, y, z]) => [x, z, -y];

function Gallery() {
  return (
    <group>
      {/* 外壁 */}
      {galleryData.exterior_walls.map(w => (
        <mesh key={w.name} position={toR3F(w.position)}>
          <boxGeometry args={[w.size[0], w.size[2], w.size[1]]} />
          <meshStandardMaterial {...materials.concrete_wall} />
        </mesh>
      ))}

      {/* 仕切り壁 */}
      {galleryData.partitions.map(p => (
        <mesh key={p.name} position={toR3F(p.position)}>
          <boxGeometry args={[p.size[0], p.size[2], p.size[1]]} />
          <meshStandardMaterial {...materials.concrete_wall} />
        </mesh>
      ))}

      {/* 中庭ガラス壁 + 水盤 */}
      {galleryData.courtyard_elements.map(e => (
        <mesh key={e.name} position={toR3F(e.position)}>
          <boxGeometry args={[e.size[0], e.size[2], e.size[1]]} />
          <meshStandardMaterial
            {...(e.name.includes('Glass') ? materials.glass :
                 e.name.includes('Water') ? materials.water :
                 materials.concrete_floor)}
          />
        </mesh>
      ))}

      {/* 作品 */}
      {galleryData.artworks.map(art => (
        <Artwork key={art.id} {...art} />
      ))}

      {/* 光スリット */}
      {galleryData.light_slits.map(s => (
        <mesh key={s.name} position={toR3F(s.position)}>
          <boxGeometry args={[s.size[0], s.size[2], s.size[1]]} />
          <meshStandardMaterial emissive="#F2F7FF" emissiveIntensity={5} />
        </mesh>
      ))}
    </group>
  );
}

function Artwork({ position, facing, size, id }) {
  const rotY = { '+x': -Math.PI/2, '-x': Math.PI/2, '+y': 0, '-y': Math.PI }[facing];
  const pos = toR3F(position);

  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh>
        <boxGeometry args={[size.width + 0.1, size.height + 0.1, 0.06]} />
        <meshStandardMaterial color="#1F1F1F" roughness={0.25} metalness={0.85} />
      </mesh>
      <mesh position={[0, 0, 0.025]}>
        <planeGeometry args={[size.width, size.height]} />
        {/* Replace with actual artwork texture */}
        <meshStandardMaterial color="#E0D9CC" />
      </mesh>
    </group>
  );
}
```
