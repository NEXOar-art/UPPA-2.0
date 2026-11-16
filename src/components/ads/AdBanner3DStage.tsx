import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const detectSoftwareWebGL = (): boolean => {
  if (typeof document === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
};

const StudioEnvironment: React.FC = () => {
  const { gl, scene } = useThree();

  useEffect(() => {
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    return () => {
      scene.environment = null;
      envTarget.dispose();
      pmremGenerator.dispose();
    };
  }, [gl, scene]);

  return null;
};

interface PromoClusterProps {
  baseX: number;
  baseY: number;
  baseZ: number;
  accentColor: string;
  speed: number;
  phase: number;
  pointerRef: React.MutableRefObject<{ x: number; y: number; hovered: boolean }>;
}

// Composite 4-part procedural 3D promo emblem (Core prism + Beveled outer ring + Inner orbit torus + Satellite spark)
const PromoEmblem3D: React.FC<PromoClusterProps> = ({
  baseX,
  baseY,
  baseZ,
  accentColor,
  speed,
  phase,
  pointerRef,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);
  const satelliteRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime * speed + phase;

    const targetX = baseX + pointerRef.current.x * (pointerRef.current.hovered ? 0.55 : 0.18);
    const targetY = baseY + Math.sin(t * 1.15) * 0.18 + pointerRef.current.y * 0.2;

    g.position.x = THREE.MathUtils.damp(g.position.x, targetX, 4.5, delta);
    g.position.y = THREE.MathUtils.damp(g.position.y, targetY, 4.5, delta);
    g.rotation.y += delta * (pointerRef.current.hovered ? 1.25 : 0.65);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, Math.sin(t * 0.7) * 0.35 + pointerRef.current.y * 0.25, 4, delta);

    if (outerRingRef.current) {
      outerRingRef.current.rotation.z -= delta * 0.9;
    }
    if (satelliteRef.current) {
      satelliteRef.current.position.x = Math.cos(t * 2.1) * 0.62;
      satelliteRef.current.position.y = Math.sin(t * 2.1) * 0.34;
    }
  });

  return (
    <group ref={groupRef} position={[baseX, baseY, baseZ]}>
      {/* 1. Primary Faceted Core Crystal */}
      <mesh>
        <octahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial
          color={accentColor}
          metalness={0.85}
          roughness={0.18}
          emissive={accentColor}
          emissiveIntensity={0.28}
        />
      </mesh>

      {/* 2. Secondary Tilted Metallic Ring */}
      <mesh ref={outerRingRef} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[0.46, 0.045, 12, 32]} />
        <meshStandardMaterial
          color="#FFFFFF"
          metalness={0.92}
          roughness={0.16}
        />
      </mesh>

      {/* 3. Accent Inner Collar */}
      <mesh rotation={[-Math.PI / 4, Math.PI / 5, 0]}>
        <torusGeometry args={[0.36, 0.025, 10, 28]} />
        <meshStandardMaterial
          color={accentColor}
          metalness={0.65}
          roughness={0.45}
        />
      </mesh>

      {/* 4. Orbiting Accent Spark */}
      <mesh ref={satelliteRef}>
        <icosahedronGeometry args={[0.075, 0]} />
        <meshStandardMaterial
          color="#B7F36B"
          metalness={0.4}
          roughness={0.22}
          emissive="#B7F36B"
          emissiveIntensity={0.6}
        />
      </mesh>
    </group>
  );
};

interface AdBanner3DStageProps {
  isHovered: boolean;
  pointerX: number;
  pointerY: number;
}

export const AdBanner3DStage: React.FC<AdBanner3DStageProps> = ({
  isHovered,
  pointerX,
  pointerY,
}) => {
  const isSoftwareGl = useMemo(() => detectSoftwareWebGL(), []);
  const pointerRef = useRef({ x: 0, y: 0, hovered: false });

  pointerRef.current.x = pointerX;
  pointerRef.current.y = pointerY;
  pointerRef.current.hovered = isHovered;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-75"
      aria-hidden="true"
    >
      <Canvas
        dpr={isSoftwareGl ? 1 : [1, 1.5]}
        camera={{ position: [0, 0, 4.2], fov: 38 }}
        gl={{
          antialias: !isSoftwareGl,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
        }}
      >
        <StudioEnvironment />
        <hemisphereLight args={['#FFF19A', '#101114', 0.8]} />
        <directionalLight position={[4, 3, 5]} intensity={1.8} color="#FFF19A" />
        <directionalLight position={[-4, -2, 3]} intensity={1.1} color="#B7F36B" />

        <PromoEmblem3D
          baseX={-3.6}
          baseY={0.05}
          baseZ={0}
          accentColor="#FFF19A"
          speed={0.9}
          phase={0}
          pointerRef={pointerRef}
        />
        <PromoEmblem3D
          baseX={0}
          baseY={-0.05}
          baseZ={-0.25}
          accentColor="#B7F36B"
          speed={1.05}
          phase={2.1}
          pointerRef={pointerRef}
        />
        <PromoEmblem3D
          baseX={3.6}
          baseY={0.05}
          baseZ={0.1}
          accentColor="#FFF19A"
          speed={0.85}
          phase={4.2}
          pointerRef={pointerRef}
        />
      </Canvas>
    </div>
  );
};
