import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { Planet } from './Planet';
import { Sun } from './Sun';
import { LESSONS } from '../data/lessons';

const PLANETS_DATA = LESSONS.map((lesson, index) => ({
  name: lesson.shortName,
  radius: 1.8 + index * 0.32,
  distance: 18 + index * 14,
  orbitalPeriod: 300 + index * 180,
  rotationPeriod: 1.2 + index * 0.3,
  colors: lesson.colors,
  tilt: 8 + index * 6,
  eccentricity: 0.01 + index * 0.008,
  atmosphere: { color: lesson.color, opacity: 0.28, scale: 1.08 },
  features: index === 0 ? 'craters' : index === 1 ? 'clouds' : index === 2 ? 'continents' : index === 3 ? 'terrain' : 'storms',
}));

interface SolarSystemProps {
  speedMultiplier: number;
  onPlanetClick: (name: string) => void;
  showOrbits: boolean;
  showLabels: boolean;
  accentColor: string;
  savedMaps: Record<string, number>;
}

export function SolarSystem({ speedMultiplier, onPlanetClick, showOrbits, showLabels, accentColor, savedMaps }: SolarSystemProps) {
  return (
    <group>
      <Sun />
      <AsteroidBelt innerRadius={44} outerRadius={49} count={140} speedMultiplier={speedMultiplier} />
      {PLANETS_DATA.map((planet, index) => (
        <Planet key={planet.name} {...planet} speedMultiplier={speedMultiplier} onClick={() => onPlanetClick(planet.name)} showLabel={showLabels}>
          {savedMaps[LESSONS[index].id] > 0 && (
            <KnowledgeSatellite
              nodeCount={savedMaps[LESSONS[index].id]}
              planetRadius={planet.radius}
              color={LESSONS[index].color}
              speedMultiplier={speedMultiplier}
            />
          )}
        </Planet>
      ))}
      {showOrbits && PLANETS_DATA.map((planet) => <OrbitPath key={planet.name} distance={planet.distance} eccentricity={planet.eccentricity} color={accentColor} />)}
    </group>
  );
}

function KnowledgeSatellite({ nodeCount, planetRadius, color, speedMultiplier }: { nodeCount: number; planetRadius: number; color: string; speedMultiplier: number }) {
  const orbitRef = useRef<THREE.Group>(null);
  const satelliteRef = useRef<THREE.Mesh>(null);
  const distance = planetRadius * 2.4 + Math.min(nodeCount, 12) * 0.08;
  const size = Math.min(0.85, 0.34 + nodeCount * 0.045);

  useFrame((state, delta) => {
    if (orbitRef.current) orbitRef.current.rotation.y = state.clock.getElapsedTime() * 0.9 * speedMultiplier;
    if (satelliteRef.current) satelliteRef.current.rotation.y += delta * 0.8 * speedMultiplier;
  });

  return (
    <group rotation={[0.35, 0, 0.2]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[distance, 0.012, 6, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.28} />
      </mesh>
      <group ref={orbitRef}>
        <mesh ref={satelliteRef} position={[distance, 0, 0]}>
          <icosahedronGeometry args={[size, 2]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} roughness={0.38} />
          <pointLight color={color} intensity={1.2} distance={5} />
        </mesh>
      </group>
    </group>
  );
}

function OrbitPath({ distance, eccentricity, color }: { distance: number; eccentricity: number; color: string }) {
  const points = useMemo(() => Array.from({ length: 129 }, (_, index) => {
    const theta = (index / 128) * Math.PI * 2;
    const radius = distance * (1 - eccentricity * eccentricity) / (1 + eccentricity * Math.cos(theta));
    return [Math.cos(theta) * radius, 0, Math.sin(theta) * radius] as [number, number, number];
  }), [distance, eccentricity]);
  return <Line points={points} color={color} lineWidth={1} transparent opacity={0.22} />;
}

function AsteroidBelt({ innerRadius, outerRadius, count, speedMultiplier }: { innerRadius: number; outerRadius: number; count: number; speedMultiplier: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const particles = useMemo(() => Array.from({ length: count }, () => ({
    angle: Math.random() * Math.PI * 2,
    radius: innerRadius + Math.random() * (outerRadius - innerRadius),
    y: (Math.random() - 0.5) * 2,
    speed: 0.1 + Math.random() * 0.2,
    scale: 0.04 + Math.random() * 0.13,
  })), [count, innerRadius, outerRadius]);

  useFrame((state) => {
    if (!ref.current) return;
    const time = state.clock.getElapsedTime();
    particles.forEach((particle, index) => {
      const angle = particle.angle + time * particle.speed * speedMultiplier;
      const matrix = new THREE.Matrix4();
      matrix.compose(new THREE.Vector3(Math.cos(angle) * particle.radius, particle.y, Math.sin(angle) * particle.radius), new THREE.Quaternion(), new THREE.Vector3(particle.scale, particle.scale, particle.scale));
      ref.current!.setMatrixAt(index, matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[undefined, undefined, count]}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#9a6e43" roughness={0.9} /></instancedMesh>;
}

export { PLANETS_DATA };
