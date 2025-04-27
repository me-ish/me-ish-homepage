import { useThree, useFrame } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import * as THREE from 'three'

export default function ThirdPersonCamera({ avatarRef }) {
  const { camera } = useThree()
  const targetPosition = useRef(new THREE.Vector3())
  const rotation = useRef({ x: -0.2, y: 0 })
  const keysPressed = useRef({})
  const isMouseDown = useRef(false)

  // ✅ マウスによる回転
  useEffect(() => {
    const dom = document.body
    const onPointerDown = () => (isMouseDown.current = true)
    const onPointerUp = () => (isMouseDown.current = false)
    const onPointerMove = (e) => {
      if (!isMouseDown.current) return
      rotation.current.y += e.movementX * 0.005
      rotation.current.x -= e.movementY * 0.005
      rotation.current.x = THREE.MathUtils.clamp(rotation.current.x, -1.2, 0.8)
    }
    dom.addEventListener('pointerdown', onPointerDown)
    dom.addEventListener('pointerup', onPointerUp)
    dom.addEventListener('pointermove', onPointerMove)
    return () => {
      dom.removeEventListener('pointerdown', onPointerDown)
      dom.removeEventListener('pointerup', onPointerUp)
      dom.removeEventListener('pointermove', onPointerMove)
    }
  }, [])

  // ✅ キーボード操作
  useEffect(() => {
    const onKeyDown = (e) => (keysPressed.current[e.key] = true)
    const onKeyUp = (e) => (keysPressed.current[e.key] = false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useFrame(() => {
    if (!avatarRef?.current) return

    // ⌨️ キー操作で回転
    if (keysPressed.current['ArrowLeft']) rotation.current.y += 0.03
    if (keysPressed.current['ArrowRight']) rotation.current.y -= 0.03
    if (keysPressed.current['ArrowUp']) rotation.current.x -= 0.03
    if (keysPressed.current['ArrowDown']) rotation.current.x += 0.03
    rotation.current.x = THREE.MathUtils.clamp(rotation.current.x, -1.2, 0.8)

    // アバター位置取得
    const avatarPos = new THREE.Vector3()
    avatarRef.current.getWorldPosition(avatarPos)

    // カメラ位置更新
    const radius = 5
    const offsetY = 1.5 + rotation.current.x * 3
    const camX = Math.sin(rotation.current.y) * radius
    const camZ = Math.cos(rotation.current.y) * radius
    targetPosition.current.set(
      avatarPos.x + camX,
      avatarPos.y + offsetY,
      avatarPos.z + camZ
    )
    camera.position.lerp(targetPosition.current, 0.1)
    camera.lookAt(avatarPos)
  })

  return null
}
