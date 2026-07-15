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
      {PLANETS_DATA.map((planet) => <Planet key={planet.name} {...planet} speedMultiplier={speedMultiplier} onClick={() => onPlanetClick(planet.name)} showLabel={showLabels} />)}
      {[27, 38, 59, 76].map((distance, index) => (
        <SystemSatellite
          key={distance}
          distance={distance}
          color={LESSONS[index % LESSONS.length].color}
          speedMultiplier={speedMultiplier}
          orbitIndex={index}
          phase={index * 1.55 + 0.4}
          isOwn={index === 3 && Object.keys(savedMaps).length > 0}
        />
      ))}
      {showOrbits && PLANETS_DATA.map((planet) => <OrbitPath key={planet.name} distance={planet.distance} eccentricity={planet.eccentricity} color={accentColor} />)}
    </group>
  );
}

function SystemSatellite({ distance, color, speedMultiplier, orbitIndex, phase, isOwn }: { distance: number; color: string; speedMultiplier: number; orbitIndex: number; phase: number; isOwn: boolean }) {
  const orbitRef = useRef<THREE.Group>(null);
  const satelliteRef = useRef<THREE.Group>(null);
  const size = isOwn ? 1.15 : 0.92 + orbitIndex * 0.05;
  const orbitSpeed = 0.18 + orbitIndex * 0.035;
  const trail = useMemo(() => Array.from({ length: isOwn ? 22 : 14 }, (_, index) => ({
    z: 0.65 + index * 0.14 + Math.random() * 0.09,
    x: (Math.random() - 0.5) * (0.05 + index * 0.018),
    y: (Math.random() - 0.5) * (0.05 + index * 0.018),
    scale: Math.max(0.018, 0.07 - index * 0.0025),
  })), [isOwn]);

  useFrame((state, delta) => {
    if (orbitRef.current) orbitRef.current.rotation.y = phase + state.clock.getElapsedTime() * orbitSpeed * speedMultiplier;
    if (satelliteRef.current) satelliteRef.current.rotation.y += delta * 0.8 * speedMultiplier;
  });

  return (
    <group rotation={[0.08 + orbitIndex * 0.055, 0, 0.04 + orbitIndex * 0.035]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[distance, 0.012, 6, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} />
      </mesh>
      <group ref={orbitRef}>
        <group ref={satelliteRef} position={[distance, 0, 0]} rotation={[0.2, -Math.PI / 2, 0]} scale={size}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.22, 0.28, 0.5, 16]} />
            <meshStandardMaterial color="#a8afbd" metalness={0.85} roughness={0.28} />
          </mesh>
          <mesh position={[0, 0, -0.24]}>
            <sphereGeometry args={[0.19, 20, 20]} />
            <meshStandardMaterial color="#d9dfeb" emissive={color} emissiveIntensity={isOwn ? 1.4 : 0.8} metalness={0.55} roughness={0.22} />
          </mesh>
          {[0, Math.PI / 2].map((rotation) => (
            <group key={rotation} rotation={[0, 0, rotation]}>
              <mesh position={[0, 0.62, 0]}>
                <boxGeometry args={[0.08, 0.82, 0.018]} />
                <meshStandardMaterial color="#243d68" emissive="#10264d" emissiveIntensity={0.5} metalness={0.7} roughness={0.35} transparent opacity={0.9} />
              </mesh>
              <mesh position={[0, -0.62, 0]}>
                <boxGeometry args={[0.08, 0.82, 0.018]} />
                <meshStandardMaterial color="#243d68" emissive="#10264d" emissiveIntensity={0.5} metalness={0.7} roughness={0.35} transparent opacity={0.9} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0, -0.47]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.2, 0.22, 20, 1, true]} />
            <meshStandardMaterial color="#c5cad4" metalness={0.9} roughness={0.2} side={THREE.DoubleSide} />
          </mesh>
          {trail.map((particle, index) => (
            <mesh key={index} position={[particle.x, particle.y, particle.z]} scale={particle.scale}>
              <sphereGeometry args={[1, 6, 6]} />
              <meshBasicMaterial color={index < 5 ? color : '#dbe7ff'} transparent opacity={Math.max(0.15, 0.85 - index * 0.035)} />
            </mesh>
          ))}
          <pointLight color={color} intensity={isOwn ? 1.8 : 0.65} distance={5} />
        </group>
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
