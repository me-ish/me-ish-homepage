'use client';

import { useEffect } from 'react';
import * as Nipple from 'react-nipple';

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
    return () => {
      document.body.removeEventListener('touchmove', preventScroll);
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 30,
        left: 30,
        zIndex: 9999,
        touchAction: 'none',
        width: 120,
        height: 120,
      }}
    >
      <Joystick
        options={{
          mode: 'static',
          position: { top: '60px', left: '60px' },
          color: '#00a1e9',
        }}
        style={{
          width: 120,
          height: 120,
        }}
        onMove={((_, data) => {
          const x = data?.vector?.x ?? 0;
          const y = data?.vector?.y ?? 0;
          console.log('🕹️ Joystick onMove:', x, y);
          onMove(x, y);
        }) as JoystickEvent}
        onEnd={() => {
          console.log('🛑 Joystick end');
          onMove(0, 0);
        }}
      />
    </div>
  );
}
