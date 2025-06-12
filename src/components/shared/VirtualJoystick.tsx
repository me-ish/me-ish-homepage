'use client';

import { useEffect } from 'react';
import * as Nipple from 'react-nipple'; // ✅ default を明示的に取り出す

const Joystick = Nipple.default;

type Vector = { x: number; y: number };
type JoystickData = { vector: Vector };
type JoystickEvent = (_: any, data: JoystickData) => void;

type Props = {
  onMove: (x: number, y: number) => void;
};

export default function VirtualJoystick({ onMove }: Props) {
  useEffect(() => {
    const preventScroll = (e: TouchEvent) => e.preventDefault();
    document.body.addEventListener('touchmove', preventScroll, { passive: false });
    return () => document.body.removeEventListener('touchmove', preventScroll);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        left: 24,
        zIndex: 9999,
        touchAction: 'none',
        width: 128,
        height: 128,
        borderRadius: '50%',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        boxShadow: '0 0 8px rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
        border: '2px solid white',
      }}
    >
      <Joystick
        options={{
          mode: 'static',
          position: { top: '64px', left: '64px' },
          color: '#ffffff',
        }}
        style={{ width: 128, height: 128 }}
        onMove={((_, data) => {
          if (data?.vector) onMove(data.vector.x, data.vector.y);
        }) as JoystickEvent}
        onEnd={() => onMove(0, 0)}
      />
    </div>
  );
}
