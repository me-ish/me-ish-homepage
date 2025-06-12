'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';

type Vector = { x: number; y: number };
type JoystickData = { vector: Vector };
type JoystickEvent = (_: any, data: JoystickData) => void;

const Nipple = dynamic(() => import('react-nipple').then(mod => mod.Joystick), {
  ssr: false,
});

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
        bottom: 32,
        left: 24,
        zIndex: 9999,
        touchAction: 'none',
        width: 128,
        height: 128,
        borderRadius: '50%',
        backgroundColor: 'rgba(0, 0, 0, 0.2)', // 半透明黒背景
        boxShadow: '0 0 8px rgba(0, 0, 0, 0.4)', // 立体感
        backdropFilter: 'blur(4px)', // 背景ぼかし（白背景対策）
        border: '2px solid white', // 枠線で視認性UP
      }}
    >
      <Nipple
        options={{
          mode: 'static',
          position: { top: '64px', left: '64px' }, // 中央
          color: '#ffffff', // 白色に変更
        }}
        style={{
          width: 128,
          height: 128,
        }}
        onMove={((_, data) => {
          if (data?.vector) {
            onMove(data.vector.x, data.vector.y);
          }
        }) as JoystickEvent}
        onEnd={() => onMove(0, 0)}
      />
    </div>
  );
}

