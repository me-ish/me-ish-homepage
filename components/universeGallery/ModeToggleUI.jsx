// components/ModeToggleUI.jsx
import { useState } from 'react'
import CameraRig from '../shared/CameraRig'
import OrbitCameraControls from './OrbitCameraControls'

export default function ModeToggleUI() {
  const [mode, setMode] = useState('walk')

  return (
    <>
      {/* ✅ UIはCanvasの外に表示されるようにする */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
        <button onClick={() => setMode((m) => (m === 'walk' ? 'orbit' : 'walk'))}>
          現在: {mode === 'walk' ? 'ウォークモード' : '鑑賞モード'}（切り替え）
        </button>
      </div>

      {/* ✅ これはThree.jsオブジェクトなのでCanvasの中に置かれる */}
      {mode === 'walk' && <CameraRig />}
      {mode === 'orbit' && <OrbitCameraControls />}
    </>
  )
}
