'use client';

import React, { useMemo } from 'react';
import { getPanelGeometry, getPanelMaterial } from './sharedGeometry';
import { FLOAT_PANELS } from './floatPanels.constants';

type PanelData = {
  position: [number, number, number];
  rotation: [number, number, number];
};

export default function FloatPanels(): React.JSX.Element {
  const panelGeometry = useMemo(() => getPanelGeometry(), []);
  const panelMaterial = useMemo(() => getPanelMaterial(), []);

  const PANEL_Y = FLOAT_PANELS.height / 2;

  const panels = useMemo<PanelData[]>(
    () =>
      FLOAT_PANELS.anglesDeg.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return {
          position: [
            Math.cos(rad) * FLOAT_PANELS.radius,
            PANEL_Y,
            Math.sin(rad) * FLOAT_PANELS.radius,
          ],
          rotation: [0, rad, 0],
        };
      }),
    [PANEL_Y]
  );

  return (
    <group>
      {panels.map((p, i) => (
        <mesh
          key={`panel-${i}`}
          position={p.position}
          rotation={p.rotation}
          geometry={panelGeometry}
          material={panelMaterial}
          receiveShadow
        />
      ))}
    </group>
  );
}
