'use client';

import React, { useRef, useState, useEffect } from 'react';

type JoystickInputProps = {
  onMove: (offset: { x: number; y: number }) => void;
};

export default function JoystickInput({ onMove }: JoystickInputProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      setCenter({ x: cx, y: cy });
      setDragging(true);
      updateKnob(touch.clientX, touch.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      const touch = e.touches[0];
      updateKnob(touch.clientX, touch.clientY);
    };

    const handleTouchEnd = () => {
      setDragging(false);
      resetKnob();
      onMove({ x: 0, y: 0 });
    };

    base.addEventListener('touchstart', handleTouchStart, { passive: false });
    base.addEventListener('touchmove', handleTouchMove, { passive: false });
    base.addEventListener('touchend', handleTouchEnd);
    base.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      base.removeEventListener('touchstart', handleTouchStart);
      base.removeEventListener('touchmove', handleTouchMove);
      base.removeEventListener('touchend', handleTouchEnd);
      base.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [dragging]);

  const updateKnob = (tx: number, ty: number) => {
    const dx = tx - center.x;
    const dy = ty - center.y;
    const distance = Math.min(Math.sqrt(dx * dx + dy * dy), 40);
    const angle = Math.atan2(dy, dx);
    const offsetX = distance * Math.cos(angle);
    const offsetY = distance * Math.sin(angle);

    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }

    onMove({
      x: offsetX / 40,
      y: -offsetY / 40,
    });
  };

  const resetKnob = () => {
    if (knobRef.current) {
      knobRef.current.style.transform = 'translate(0px, 0px)';
    }
  };

  return (
<div
  ref={baseRef}
  className="fixed bottom-6 left-6 w-[100px] h-[100px] rounded-full bg-cyan-100 border border-cyan-500 z-50 touch-none"
>
  <div
    ref={knobRef}
    className={`w-10 h-10 rounded-full bg-cyan-500 absolute top-[30px] left-[30px] transition-transform duration-100 ease-out ${
      dragging ? '' : 'transition'
    }`}
  />
</div>

  );
}
