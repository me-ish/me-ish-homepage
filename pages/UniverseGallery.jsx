import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { SRGBColorSpace } from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

import ThirdPersonCamera from '../components/shared/ThirdPersonCamera';
import CylinderGallery from '../components/universeGallery/CylinderGallery';
import Lighting from '../components/universeGallery/Lighting';
import { CoreSphere } from '../components/shared/CoreSphere'; // ← 修正①（named import）
import GalleryFloor from '../components/universeGallery/GalleryFloor';
import GalleryPulseRing from '../components/universeGallery/GalleryPulseRing';
import CenterAuraCircle from '../components/universeGallery/CenterAuraCircle';
import WallLightRing from '../components/universeGallery/WallLightRing';
import SkyStars from '../components/universeGallery/SkyStars';
import OrbitalParticles from '../components/universeGallery/OrbitalParticles';
import ArtworksInGallery from '../components/whiteGallery/ArtworksInGallery';
import Avatar from '../components/shared/Avatar';
import AvatarController from '../components/shared/AvatarController';
import JoystickInput from '../components/shared/JoystickInput';

function PulseProvider({ children }) {
  const pulseRef = useRef(0);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const rawPulse = Math.sin(t * 1.8);
    const pulse = rawPulse > 0 ? Math.pow(rawPulse, 0.3) * Math.exp(-rawPulse * 4.0) : 0;
    pulseRef.current = pulse;
  });

  return React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { pulseRef });
    }
    return child;
  });
}

const UniverseGallery = () => {
  const avatarRef = useRef();
  const [cameraMode, setCameraMode] = useState('intro');
  const [joystick, setJoystick] = useState({ x: 0, y: 0 });

  return (
    <>
      <JoystickInput onMove={({ x, y }) => setJoystick({ x, y })} />

      <Canvas
        camera={{ position: [0, 2, 10], fov: 50 }}
        gl={{ physicallyCorrectLights: true }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace;
        }}
      >

        <Avatar ref={avatarRef} />
        <AvatarController avatarRef={avatarRef} joystick={joystick} />

        <Lighting />
        <CylinderGallery />
        <WallLightRing />
        <GalleryFloor />
        <CenterAuraCircle />
        <CoreSphere /> {/* ← 修正③：ここで使う */}

        <PulseProvider>
          <GalleryPulseRing />
        </PulseProvider>

        <OrbitalParticles />
        <SkyStars />
        <ArtworksInGallery />

        <EffectComposer>
          <Bloom
            intensity={0.1}
            luminanceThreshold={0.1}
            luminanceSmoothing={0.1}
          />
        </EffectComposer>
      </Canvas>
    </>
  );
};

export default UniverseGallery;
