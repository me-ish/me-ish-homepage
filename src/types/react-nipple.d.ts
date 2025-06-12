declare module 'react-nipple' {
  import { ComponentType } from 'react';

  export interface JoystickProps {
    options?: {
      mode?: string;
      position?: { top: string; left: string };
      color?: string;
    };
    style?: React.CSSProperties;
    onMove?: (evt: any, data: { vector: { x: number; y: number } }) => void;
    onEnd?: () => void;
  }

  const Joystick: ComponentType<JoystickProps>;
  export default Joystick;
}
