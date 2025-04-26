import React, { useRef, useState, useEffect } from 'react'

export default function JoystickInput({ onMove }) {
  const baseRef = useRef(null)
  const knobRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  // 中心からの相対座標を返す関数
  const getOffset = (touch, rect) => {
    const x = touch.clientX - (rect.left + rect.width / 2)
    const y = touch.clientY - (rect.top + rect.height / 2)
    const radius = rect.width / 2
    return {
      x: Math.max(-radius, Math.min(radius, x)) / radius,
      y: Math.max(-radius, Math.min(radius, y)) / radius,
    }
  }

  const handleTouchStart = (e) => {
    setDragging(true)
    const rect = baseRef.current.getBoundingClientRect()
    const offset = getOffset(e.touches[0], rect)
    knobRef.current.style.transform = `translate(${offset.x * 40}px, ${offset.y * 40}px)`
    onMove({ x: offset.x, y: offset.y })
  }

  const handleTouchMove = (e) => {
    if (!dragging) return
    const rect = baseRef.current.getBoundingClientRect()
    const offset = getOffset(e.touches[0], rect)
    knobRef.current.style.transform = `translate(${offset.x * 40}px, ${offset.y * 40}px)`
    onMove({ x: offset.x, y: offset.y })
  }

  const handleTouchEnd = () => {
    setDragging(false)
    knobRef.current.style.transform = 'translate(0px, 0px)'
    onMove({ x: 0, y: 0 })
  }

  useEffect(() => {
    const el = baseRef.current
    el.addEventListener('touchstart', handleTouchStart)
    el.addEventListener('touchmove', handleTouchMove)
    el.addEventListener('touchend', handleTouchEnd)

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  return (
    <div
      ref={baseRef}
      style={{
        position: 'absolute',
        bottom: 30,
        left: 30,
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.3)',
        touchAction: 'none',
        zIndex: 20,
      }}
    >
      <div
        ref={knobRef}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.3)',
          transform: 'translate(0, 0)',
          transition: dragging ? 'none' : 'transform 0.1s ease',
        }}
      />
    </div>
  )
}
