import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface AtmosphereData {
  color: string;
  opacity: number;
  scale: number;
}

interface PlanetProps {
  name: string;
  radius: number;
  distance: number;
  orbitalPeriod: number;
  rotationPeriod: number;
  colors: string[];
  tilt: number;
  eccentricity: number;
  hasRings?: boolean;
  ringColor?: string;
  ringOpacity?: number;
  hasMoon?: boolean;
  atmosphere?: AtmosphereData | null;
  features?: string;
  speedMultiplier: number;
  onClick: () => void;
  showLabel: boolean;
}

export function Planet({
  name,
  radius,
  distance,
  orbitalPeriod,
  rotationPeriod,
  colors,
  tilt,
  eccentricity,
  hasRings,
  ringColor = '#C9A227',
  ringOpacity = 0.7,
  hasMoon,
  atmosphere,
  features,
  speedMultiplier,
  onClick,
  showLabel,
}: PlanetProps) {
  const planetRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const orbitRef = useRef<THREE.Group>(null);
  const moonRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const ringsRef = useRef<THREE.Group>(null);

  // Random starting position
  const startAngle = useMemo(() => Math.random() * Math.PI * 2, []);

  const glowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.45)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.08)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);

  // Create procedural texture for planet
  const planetTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Base gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    colors.forEach((color, i) => {
      gradient.addColorStop(i / (colors.length - 1), color);
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add features based on planet type
    if (features === 'craters') {
      // Mercury-like craters
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const r = 2 + Math.random() * 15;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 0, 0, ${0.1 + Math.random() * 0.2})`;
        ctx.fill();
      }
    } else if (features === 'continents') {
      // Earth-like continents
      ctx.fillStyle = '#2E5A1C';
      // Simple continent shapes
      ctx.beginPath();
      ctx.ellipse(150, 100, 60, 40, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(350, 80, 40, 50, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(400, 160, 30, 25, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(100, 180, 35, 30, 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Ice caps
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, 15);
      ctx.fillRect(0, canvas.height - 15, canvas.width, 15);
    } else if (features === 'bands') {
      // Jupiter/Saturn-like bands
      for (let y = 0; y < canvas.height; y += 12) {
        const alpha = 0.1 + Math.random() * 0.3;
        const hue = Math.random() > 0.5 ? 30 : 40;
        ctx.fillStyle = `hsla(${hue}, 50%, ${40 + Math.random() * 20}%, ${alpha})`;
        ctx.fillRect(0, y, canvas.width, 8 + Math.random() * 8);
      }
      // Great Red Spot for Jupiter
      if (name === 'Jupiter') {
        ctx.beginPath();
        ctx.ellipse(300, 120, 25, 15, 0.2, 0, Math.PI * 2);
        ctx.fillStyle = '#CD5C5C';
        ctx.fill();
      }
    } else if (features === 'terrain') {
      // Mars-like terrain
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const r = 1 + Math.random() * 8;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${100 + Math.random() * 50}, ${30 + Math.random() * 20}, 0, ${0.2 + Math.random() * 0.3})`;
        ctx.fill();
      }
      // Polar ice
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(0, 0, canvas.width, 10);
      ctx.fillRect(0, canvas.height - 10, canvas.width, 10);
    } else if (features === 'storms') {
      // Neptune-like storms
      for (let i = 0; i < 5; i++) {
        const x = Math.random() * canvas.width;
        const y = 50 + Math.random() * (canvas.height - 100);
        ctx.beginPath();
        ctx.ellipse(x, y, 20 + Math.random() * 30, 10 + Math.random() * 15, Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + Math.random() * 0.2})`;
        ctx.fill();
      }
    } else if (features === 'ice') {
      // Uranus-like ice patterns
      for (let y = 0; y < canvas.height; y += 20) {
        ctx.fillStyle = `rgba(200, 220, 255, ${0.05 + Math.random() * 0.1})`;
        ctx.fillRect(0, y, canvas.width, 10 + Math.random() * 10);
      }
    } else if (features === 'clouds') {
      // Venus-like cloud swirls
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        ctx.beginPath();
        ctx.ellipse(x, y, 30 + Math.random() * 50, 5 + Math.random() * 10, Math.random() * Math.PI * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 240, 200, ${0.1 + Math.random() * 0.15})`;
        ctx.fill();
      }
    }

    // Add noise for texture
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 20;
      imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + noise));
      imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] + noise));
      imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }, [colors, features, name]);

  // Create bump map
  const bumpTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = 1 + Math.random() * 5;
      const brightness = Math.random() * 100 + 100;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
      ctx.fill();
    }
    
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Ring texture
  const ringTexture = useMemo(() => {
    if (!hasRings) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    // Create ring bands
    for (let x = 0; x < canvas.width; x++) {
      const density = Math.sin(x * 0.1) * 0.5 + 0.5;
      const gap = Math.sin(x * 0.3) > 0.8 ? 0 : 1;
      const alpha = density * gap * (0.3 + Math.random() * 0.5);
      ctx.fillStyle = name === 'Saturn' 
        ? `rgba(210, 180, 140, ${alpha})`
        : `rgba(180, 200, 220, ${alpha * 0.5})`;
      ctx.fillRect(x, 0, 1, canvas.height);
    }
    
    return new THREE.CanvasTexture(canvas);
  }, [hasRings, name]);

  // Orbital speed
  const orbitalSpeed = useMemo(() => (365 / orbitalPeriod) * 0.5, [orbitalPeriod]);
  
  // Rotation speed
  const rotationSpeed = useMemo(() => {
    return (1 / Math.abs(rotationPeriod)) * (rotationPeriod < 0 ? -1 : 1) * 2;
  }, [rotationPeriod]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    if (orbitRef.current) {
      const angle = startAngle + time * orbitalSpeed * speedMultiplier;
      const r = distance * (1 - eccentricity * eccentricity) / (1 + eccentricity * Math.cos(angle));
      
      orbitRef.current.position.x = Math.cos(angle) * r;
      orbitRef.current.position.z = Math.sin(angle) * r;
    }

    if (planetRef.current) {
      planetRef.current.rotation.y += delta * rotationSpeed * speedMultiplier;
    }

    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * rotationSpeed * speedMultiplier * 1.2;
    }

    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y += delta * 0.05 * speedMultiplier;
    }

    if (moonRef.current) {
      const moonAngle = time * 3 * speedMultiplier;
      const moonDistance = radius * 2.5;
      moonRef.current.position.x = Math.cos(moonAngle) * moonDistance;
      moonRef.current.position.z = Math.sin(moonAngle) * moonDistance;
      moonRef.current.position.y = Math.sin(moonAngle * 0.5) * 0.3;
      moonRef.current.rotation.y += delta * speedMultiplier;
    }

    if (ringsRef.current) {
      ringsRef.current.rotation.z += delta * 0.02 * speedMultiplier;
    }
  });

  return (
    <group ref={orbitRef}>
      {/* Planet mesh */}
      <mesh
        ref={planetRef}
        rotation={[THREE.MathUtils.degToRad(tilt), 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      >
        <sphereGeometry args={[radius, 64, 64]} />
        <meshStandardMaterial
          map={planetTexture}
          bumpMap={bumpTexture}
          bumpScale={0.02}
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      {/* Atmosphere layer */}
      {atmosphere && (
        <mesh ref={atmosphereRef} scale={atmosphere.scale}>
          <sphereGeometry args={[radius, 32, 32]} />
          <meshBasicMaterial
            color={atmosphere.color}
            transparent
            opacity={atmosphere.opacity}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Glow effect */}
      {atmosphere && (
        <sprite scale={[radius * 4, radius * 4, 1]}>
          <spriteMaterial
            map={glowTexture}
            color={atmosphere.color}
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      )}

      {/* Clouds for Earth/Venus */}
      {(name === 'Earth' || name === 'Venus') && (
        <mesh ref={cloudsRef} scale={1.02} rotation={[THREE.MathUtils.degToRad(tilt), 0, 0]}>
          <sphereGeometry args={[radius, 32, 32]} />
          <meshStandardMaterial
            color="#ffffff"
            transparent
            opacity={name === 'Venus' ? 0.9 : 0.4}
            alphaTest={0.1}
          />
        </mesh>
      )}

      {/* Saturn-style rings */}
      {hasRings && (
        <group ref={ringsRef} rotation={[Math.PI / 2 + THREE.MathUtils.degToRad(tilt), 0, 0]}>
          {/* Inner ring */}
          <mesh>
            <ringGeometry args={[radius * 1.3, radius * 1.8, 128]} />
            <meshStandardMaterial
              map={ringTexture}
              color={ringColor}
              side={THREE.DoubleSide}
              transparent
              opacity={ringOpacity}
            />
          </mesh>
          {/* Outer ring */}
          <mesh>
            <ringGeometry args={[radius * 1.9, radius * 2.5, 128]} />
            <meshStandardMaterial
              map={ringTexture}
              color={ringColor}
              side={THREE.DoubleSide}
              transparent
              opacity={ringOpacity * 0.6}
            />
          </mesh>
          {/* Ring shadow effect */}
          <mesh position={[0, 0, -0.01]}>
            <ringGeometry args={[radius * 1.3, radius * 2.5, 128]} />
            <meshBasicMaterial
              color="#000000"
              side={THREE.DoubleSide}
              transparent
              opacity={0.3}
            />
          </mesh>
        </group>
      )}

      {/* Earth's Moon */}
      {hasMoon && (
        <group>
          <mesh ref={moonRef}>
            <sphereGeometry args={[radius * 0.27, 32, 32]} />
            <meshStandardMaterial color="#C0C0C0" roughness={1} metalness={0} />
          </mesh>
          {/* Moon orbit visualization */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radius * 2.5, 0.02, 8, 64]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.1} />
          </mesh>
        </group>
      )}

      {/* Planet label */}
      {showLabel && (
        <Html
          position={[0, radius + 1.5, 0]}
          center
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div className="text-white text-xs font-medium px-2 py-1 bg-black/50 rounded-full backdrop-blur-sm whitespace-nowrap">
            {name}
          </div>
        </Html>
      )}
    </group>
  );
}
