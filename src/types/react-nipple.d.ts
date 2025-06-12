declare module 'react-nipple' {
  import { ComponentType } from 'react';

  export interface JoystickProps {
    options?: {
      mode?: string;
      zone?: HTMLElement;
      color?: string;
      position?: { top: string; left: string };
      size?: number;
    };
    style?: React.CSSProperties;
    onMove?: (evt: any, data: { vector: { x: number; y: number } }) => void;
    onEnd?: () => void;
  }

  export const Joystick: ComponentType<JoystickProps>;
  export default Joystick;
}
