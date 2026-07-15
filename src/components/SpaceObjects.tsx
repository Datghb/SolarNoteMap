import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SpaceObjectProps {
  onSelect?: () => void;
}

function useGlowTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.12)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);
}

// ============================================
// MILKY WAY GALAXY BACKGROUND
// ============================================
export function MilkyWayGalaxy({ color = '#4a00e0', onSelect }: { color: string } & SpaceObjectProps) {
  const galaxyRef = useRef<THREE.Points>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const glowTexture = useGlowTexture();

  const { positions, colors, sizes } = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];
    const count = 15000;
    const color1 = new THREE.Color('#ffffff');
    const color2 = new THREE.Color('#aaccff');
    const color3 = new THREE.Color(color);

    for (let i = 0; i < count; i++) {
      // Spiral galaxy pattern
      const arm = Math.floor(Math.random() * 4);
      const armAngle = (arm / 4) * Math.PI * 2;
      const distance = 50 + Math.random() * 300;
      const spiralAngle = (distance / 50) * 0.5 + armAngle;
      const spread = (Math.random() - 0.5) * (distance * 0.2);

      const x = Math.cos(spiralAngle) * distance + spread;
      const z = Math.sin(spiralAngle) * distance + spread;
      const y = (Math.random() - 0.5) * 30;

      positions.push(x, y - 150, z - 400);

      // Color variation
      const mixFactor = Math.random();
      const starColor = mixFactor < 0.3 ? color1 : mixFactor < 0.6 ? color2 : color3;
      colors.push(starColor.r, starColor.g, starColor.b);
      sizes.push(0.5 + Math.random() * 2);
    }

    return {
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
      sizes: new Float32Array(sizes),
    };
  }, [color]);

  useFrame((state) => {
    if (galaxyRef.current) {
      galaxyRef.current.rotation.y = state.clock.getElapsedTime() * 0.01;
    }
    if (coreRef.current) {
      coreRef.current.rotation.z = state.clock.getElapsedTime() * 0.02;
      const scale = 1 + Math.sin(state.clock.getElapsedTime() * 0.5) * 0.1;
      coreRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group 
      position={[0, -100, -400]}
      onClick={(e) => {
        if (onSelect) {
          e.stopPropagation();
          onSelect();
        }
      }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      {/* Invisible hitbox for better clicking */}
      <mesh visible={false} scale={[600, 100, 600]}>
         <boxGeometry />
      </mesh>

      {/* Galaxy stars */}
      <points ref={galaxyRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
          <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
        </bufferGeometry>
        <pointsMaterial
          map={glowTexture}
          size={1.5}
          vertexColors
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          alphaTest={0.01}
          depthWrite={false}
        />
      </points>

      {/* Galaxy core glow */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[40, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Core bright center */}
      <sprite scale={[150, 150, 1]}>
        <spriteMaterial
          map={glowTexture}
          color="#ffffff"
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}

// ============================================
// STAR CLUSTERS
// ============================================
export function StarCluster({
  position,
  count = 500,
  radius = 20,
  color = '#ffffff',
  onSelect
}: {
  position: [number, number, number];
  count?: number;
  radius?: number;
  color?: string;
} & SpaceObjectProps) {
  const clusterRef = useRef<THREE.Points>(null);
  const glowTexture = useGlowTexture();

  const { positions, sizes } = useMemo(() => {
    const positions: number[] = [];
    const sizes: number[] = [];

    for (let i = 0; i < count; i++) {
      // Gaussian distribution for cluster density
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * Math.pow(Math.random(), 0.5);

      positions.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
      sizes.push(0.3 + Math.random() * 0.7);
    }

    return {
      positions: new Float32Array(positions),
      sizes: new Float32Array(sizes),
    };
  }, [count, radius]);

  useFrame((state) => {
    if (clusterRef.current) {
      clusterRef.current.rotation.y = state.clock.getElapsedTime() * 0.02;
      clusterRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.01) * 0.1;
    }
  });

  return (
    <group 
      position={position}
      onClick={(e) => {
        if (onSelect) {
          e.stopPropagation();
          onSelect();
        }
      }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      <points ref={clusterRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
        </bufferGeometry>
        <pointsMaterial
          map={glowTexture}
          color={color}
          size={1}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          alphaTest={0.01}
          depthWrite={false}
        />
      </points>

      {/* Cluster glow / Hitbox */}
      <mesh visible={false}>
        <sphereGeometry args={[radius, 16, 16]} />
      </mesh>

      <sprite scale={[radius * 2, radius * 2, 1]}>
        <spriteMaterial
          map={glowTexture}
          color={color}
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}

// ============================================
// WORMHOLE
// ============================================
export function Wormhole({
  position,
  scale = 1,
  color = '#00ffff',
  onSelect
}: {
  position: [number, number, number];
  scale?: number;
  color?: string;
} & SpaceObjectProps) {
  const wormholeRef = useRef<THREE.Group>(null);
  const ringRefs = useRef<THREE.Mesh[]>([]);
  const particlesRef = useRef<THREE.Points>(null);
  const glowTexture = useGlowTexture();

  const { particlePositions, particleSpeeds } = useMemo(() => {
    const particlePositions: number[] = [];
    const particleSpeeds: number[] = [];

    // Tunnel particles
    for (let i = 0; i < 2000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const depth = Math.random() * 50;
      const radius = 5 + depth * 0.3;

      particlePositions.push(
        Math.cos(theta) * radius,
        Math.sin(theta) * radius,
        -depth
      );
      particleSpeeds.push(0.5 + Math.random() * 1.5);
    }

    return {
      particlePositions: new Float32Array(particlePositions),
      particleSpeeds,
    };
  }, []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (wormholeRef.current) {
      wormholeRef.current.rotation.z = time * 0.5;
    }

    // Animate rings
    ringRefs.current.forEach((ring, i) => {
      if (ring) {
        ring.rotation.z = time * (0.5 + i * 0.1);
        ring.scale.setScalar(1 + Math.sin(time * 2 + i) * 0.1);
      }
    });

    // Animate particles flowing into wormhole
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length / 3; i++) {
        const i3 = i * 3;
        positions[i3 + 2] += particleSpeeds[i] * 0.1;
        if (positions[i3 + 2] > 0) {
          positions[i3 + 2] = -50;
        }
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group 
      position={position} 
      scale={scale}
      onClick={(e) => {
        if (onSelect) {
          e.stopPropagation();
          onSelect();
        }
      }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      <group ref={wormholeRef}>
        {/* Concentric rings */}
        {[...Array(8)].map((_, i) => (
          <mesh
            key={i}
            ref={(el) => {
              if (el) ringRefs.current[i] = el;
            }}
            position={[0, 0, -i * 3]}
          >
            <torusGeometry args={[8 - i * 0.5, 0.2, 16, 64]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.8 - i * 0.08}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}

        {/* Event horizon */}
        <mesh position={[0, 0, -30]}>
          <circleGeometry args={[4, 64]} />
          <meshBasicMaterial color="#000000" side={THREE.DoubleSide} />
        </mesh>

        {/* Particles */}
        <points ref={particlesRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
          </bufferGeometry>
          <pointsMaterial
            map={glowTexture}
            color={color}
            size={0.3}
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
            sizeAttenuation
            alphaTest={0.01}
            depthWrite={false}
          />
        </points>

        {/* Outer glow */}
        <sprite scale={[40, 40, 1]}>
          <spriteMaterial
            map={glowTexture}
            color={color}
            transparent
            opacity={0.3}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>

        {/* Accretion disk */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[12, 4, 2, 64]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.2}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}

// ============================================
// BLACK HOLE
// ============================================
export function BlackHole({
  position,
  scale = 1,
  onSelect
}: {
  position: [number, number, number];
  scale?: number;
} & SpaceObjectProps) {
  const blackHoleRef = useRef<THREE.Group>(null);
  const accretionRef = useRef<THREE.Mesh>(null);
  const lensRef = useRef<THREE.Mesh>(null);
  const glowTexture = useGlowTexture();

  const accretionTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Create accretion disk gradient
    const gradient = ctx.createRadialGradient(256, 256, 50, 256, 256, 256);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.2, 'rgba(255, 100, 0, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 200, 50, 1)');
    gradient.addColorStop(0.7, 'rgba(255, 100, 0, 0.6)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // Add swirl pattern
    for (let i = 0; i < 1000; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 80 + Math.random() * 150;
      const x = 256 + Math.cos(angle) * r;
      const y = 256 + Math.sin(angle) * r;
      ctx.beginPath();
      ctx.arc(x, y, 1 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, ${150 + Math.random() * 105}, ${Math.random() * 100}, ${0.5 + Math.random() * 0.5})`;
      ctx.fill();
    }

    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (blackHoleRef.current) {
      blackHoleRef.current.rotation.y = time * 0.1;
    }

    if (accretionRef.current) {
      accretionRef.current.rotation.z = time * 0.3;
    }

    if (lensRef.current) {
      lensRef.current.rotation.x = Math.sin(time * 0.2) * 0.1;
      lensRef.current.rotation.y = Math.cos(time * 0.15) * 0.1;
    }
  });

  return (
    <group 
      position={position} 
      scale={scale} 
      ref={blackHoleRef}
      onClick={(e) => {
        if (onSelect) {
          e.stopPropagation();
          onSelect();
        }
      }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      {/* Event horizon (the black sphere) */}
      <mesh>
        <sphereGeometry args={[5, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Photon sphere / gravitational lensing ring */}
      <mesh ref={lensRef}>
        <torusGeometry args={[7, 0.3, 16, 100]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Accretion disk */}
      <mesh ref={accretionRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6, 25, 128]} />
        <meshBasicMaterial
          map={accretionTexture}
          transparent
          opacity={0.9}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Relativistic jets */}
      <mesh position={[0, 15, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[3, 30, 32]} />
        <meshBasicMaterial
          color="#00aaff"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, -15, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[3, 30, 32]} />
        <meshBasicMaterial
          color="#00aaff"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Gravitational distortion effect */}
      <sprite scale={[50, 50, 1]}>
        <spriteMaterial
          map={glowTexture}
          color="#ff6600"
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}

// ============================================
// COMET
// ============================================
export function Comet({
  startPosition,
  speed = 1,
  color = '#00ffff',
  onSelect
}: {
  startPosition: [number, number, number];
  speed?: number;
  color?: string;
} & SpaceObjectProps) {
  const cometRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Points>(null);
  const glowTexture = useGlowTexture();

  const tailParticles = useMemo(() => {
    const positions: number[] = [];
    const sizes: number[] = [];
    const count = 500;

    for (let i = 0; i < count; i++) {
      const t = i / count;
      const spread = t * 3;
      positions.push(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread,
        t * 20
      );
      sizes.push((1 - t) * 0.5);
    }

    return {
      positions: new Float32Array(positions),
      sizes: new Float32Array(sizes),
    };
  }, []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (cometRef.current) {
      // Elliptical orbit
      const angle = time * speed * 0.1;
      const a = 150; // semi-major axis
      const b = 80; // semi-minor axis
      const x = startPosition[0] + Math.cos(angle) * a;
      const z = startPosition[2] + Math.sin(angle) * b;
      const y = startPosition[1] + Math.sin(angle * 2) * 20;

      cometRef.current.position.set(x, y, z);

      // Point tail away from sun
      cometRef.current.lookAt(0, 0, 0);
      cometRef.current.rotateY(Math.PI);
    }

    if (tailRef.current) {
      tailRef.current.rotation.z = Math.sin(time * 3) * 0.1;
    }
  });

  return (
    <group 
      ref={cometRef} 
      position={startPosition}
      onClick={(e) => {
        if (onSelect) {
          e.stopPropagation();
          onSelect();
        }
      }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      {/* Increase hitbox size */}
      <mesh visible={false} scale={[5, 5, 5]}>
        <sphereGeometry />
      </mesh>

      {/* Comet nucleus */}
      <mesh>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial color="#aaaaaa" roughness={0.9} />
      </mesh>

      {/* Coma (gas cloud around nucleus) */}
      <mesh>
        <sphereGeometry args={[2, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Tail particles */}
      <points ref={tailRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[tailParticles.positions, 3]} />
          <bufferAttribute attach="attributes-size" args={[tailParticles.sizes, 1]} />
        </bufferGeometry>
        <pointsMaterial
          map={glowTexture}
          color={color}
          size={0.5}
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          alphaTest={0.01}
          depthWrite={false}
        />
      </points>

      {/* Ion tail (blue) */}
      <mesh rotation={[0, 0, 0]}>
        <coneGeometry args={[1.5, 25, 16]} />
        <meshBasicMaterial
          color="#0066ff"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Dust tail (yellow/white) */}
      <mesh rotation={[0, 0, 0.3]}>
        <coneGeometry args={[2, 20, 16]} />
        <meshBasicMaterial
          color="#ffffaa"
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// ============================================
// NEBULA
// ============================================
export function Nebula({
  position,
  scale = 1,
  colors = ['#ff0066', '#6600ff', '#00ffff'],
  onSelect
}: {
  position: [number, number, number];
  scale?: number;
  colors?: string[];
} & SpaceObjectProps) {
  const nebulaRef = useRef<THREE.Group>(null);

  const clouds = useMemo(() => {
    const cloudData: { position: [number, number, number]; scale: number; color: string; opacity: number }[] = [];

    for (let i = 0; i < 20; i++) {
      cloudData.push({
        position: [
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 60,
          (Math.random() - 0.5) * 100,
        ] as [number, number, number],
        scale: 20 + Math.random() * 40,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 0.05 + Math.random() * 0.1,
      });
    }

    return cloudData;
  }, [colors]);

  useFrame((state) => {
    if (nebulaRef.current) {
      nebulaRef.current.rotation.y = state.clock.getElapsedTime() * 0.005;
    }
  });

  return (
    <group 
      ref={nebulaRef} 
      position={position} 
      scale={scale}
      onClick={(e) => {
        if (onSelect) {
          e.stopPropagation();
          onSelect();
        }
      }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      {/* Hitbox */}
      <mesh visible={false} scale={[80, 50, 80]}>
        <sphereGeometry />
      </mesh>

      {clouds.map((cloud, i) => (
        <mesh key={i} position={cloud.position}>
          <sphereGeometry args={[cloud.scale, 16, 16]} />
          <meshBasicMaterial
            color={cloud.color}
            transparent
            opacity={cloud.opacity}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Nebula stars */}
      <NebulaStars count={300} radius={80} />
    </group>
  );
}

function NebulaStars({ count, radius }: { count: number; radius: number }) {
  const glowTexture = useGlowTexture();
  const positions = useMemo(() => {
    const pos: number[] = [];
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = radius * Math.random();
      pos.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
    }
    return new Float32Array(pos);
  }, [count, radius]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={glowTexture}
        color="#ffffff"
        size={0.8}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        alphaTest={0.01}
        depthWrite={false}
      />
    </points>
  );
}

// ============================================
// PULSAR
// ============================================
export function Pulsar({
  position,
  color = '#00ffff',
  onSelect
}: {
  position: [number, number, number];
  color?: string;
} & SpaceObjectProps) {
  const pulsarRef = useRef<THREE.Group>(null);
  const beamRef1 = useRef<THREE.Mesh>(null);
  const beamRef2 = useRef<THREE.Mesh>(null);
  const glowTexture = useGlowTexture();

  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    if (pulsarRef.current) {
      pulsarRef.current.rotation.y = time * 5;
    }

    if (beamRef1.current && beamRef2.current) {
      const intensity = 0.3 + Math.abs(Math.sin(time * 10)) * 0.4;
      (beamRef1.current.material as THREE.MeshBasicMaterial).opacity = intensity;
      (beamRef2.current.material as THREE.MeshBasicMaterial).opacity = intensity;
    }
  });

  return (
    <group 
      position={position}
      onClick={(e) => {
        if (onSelect) {
          e.stopPropagation();
          onSelect();
        }
      }}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      {/* Neutron star core */}
      <mesh>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Magnetic field beams */}
      <group ref={pulsarRef}>
        <mesh ref={beamRef1} position={[0, 20, 0]} rotation={[0, 0, 0]}>
          <coneGeometry args={[2, 40, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh ref={beamRef2} position={[0, -20, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[2, 40, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* Glow */}
      <sprite scale={[15, 15, 1]}>
        <spriteMaterial
          map={glowTexture}
          color={color}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}

// ============================================
// SHOOTING STARS
// ============================================
export function ShootingStars({ count = 5, color = '#ffffff' }: { count?: number; color?: string }) {
  const starsRef = useRef<THREE.Group>(null);
  const shootingStars = useMemo(() => {
    return [...Array(count)].map(() => ({
      startPos: [
        (Math.random() - 0.5) * 400,
        50 + Math.random() * 100,
        -100 - Math.random() * 200,
      ] as [number, number, number],
      speed: 50 + Math.random() * 100,
      delay: Math.random() * 10,
      direction: new THREE.Vector3(
        -0.5 + Math.random() * 0.3,
        -0.3 - Math.random() * 0.2,
        0.1 + Math.random() * 0.2
      ).normalize(),
    }));
  }, [count]);

  return (
    <group ref={starsRef}>
      {shootingStars.map((star, i) => (
        <ShootingStar key={i} {...star} color={color} />
      ))}
    </group>
  );
}

function ShootingStar({
  startPos,
  speed,
  delay,
  direction,
  color,
}: {
  startPos: [number, number, number];
  speed: number;
  delay: number;
  direction: THREE.Vector3;
  color: string;
}) {
  const ref = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (!ref.current || !meshRef.current) return;

    const cycleTime = 8;
    const t = ((time + delay) % cycleTime) / cycleTime;

    if (t < 0.2) {
      const progress = t / 0.2;
      ref.current.visible = true;
      ref.current.position.set(
        startPos[0] + direction.x * progress * speed,
        startPos[1] + direction.y * progress * speed,
        startPos[2] + direction.z * progress * speed
      );
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
    } else {
      ref.current.visible = false;
    }
  });

  return (
    <group ref={ref}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <coneGeometry args={[0.2, 5, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// ============================================
// DISTANT GALAXIES
// ============================================
export function DistantGalaxies({ count = 10, onSelect }: { count?: number } & SpaceObjectProps) {
  const galaxies = useMemo(() => {
    return [...Array(count)].map(() => ({
      position: [
        (Math.random() - 0.5) * 600,
        (Math.random() - 0.5) * 300,
        -200 - Math.random() * 400,
      ] as [number, number, number],
      scale: 5 + Math.random() * 15,
      rotation: Math.random() * Math.PI * 2,
      color: ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181'][
        Math.floor(Math.random() * 5)
      ],
      type: Math.random() > 0.5 ? 'spiral' : 'elliptical',
    }));
  }, [count]);

  return (
    <group>
      {galaxies.map((galaxy, i) => (
        <DistantGalaxy 
          key={i} 
          {...galaxy} 
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

function DistantGalaxy({
  position,
  scale,
  rotation,
  color,
  type,
  onSelect
}: {
  position: [number, number, number];
  scale: number;
  rotation: number;
  color: string;
  type: string;
  onSelect?: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const glowTexture = useGlowTexture();

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.z = rotation + state.clock.getElapsedTime() * 0.01;
    }
  });

  return (
    <group 
      ref={ref} 
      position={position}
      onClick={(e) => {
        if (onSelect) {
          e.stopPropagation();
          onSelect();
        }
      }}
      onPointerOver={() => { if(onSelect) document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { if(onSelect) document.body.style.cursor = 'default'; }}
    >
      {/* Invisible hitbox */}
      <mesh visible={false}>
        <sphereGeometry args={[scale, 8, 8]} />
      </mesh>

      {type === 'spiral' ? (
        <>
          <sprite scale={[scale, scale * 0.3, 1]} rotation={[0, 0, rotation]}>
            <spriteMaterial
              map={glowTexture}
              color={color}
              transparent
              opacity={0.6}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </sprite>
          <sprite scale={[scale * 0.4, scale * 0.4, 1]}>
            <spriteMaterial
              map={glowTexture}
              color="#ffffff"
              transparent
              opacity={0.8}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </sprite>
        </>
      ) : (
        <sprite scale={[scale * 0.6, scale * 0.4, 1]}>
          <spriteMaterial
            map={glowTexture}
            color={color}
            transparent
            opacity={0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      )}
    </group>
  );
}

// ============================================
// SPACE DUST
// ============================================
export function SpaceDust({ count = 3000, color = '#ffffff' }: { count?: number; color?: string }) {
  const dustRef = useRef<THREE.Points>(null);
  const glowTexture = useGlowTexture();

  const positions = useMemo(() => {
    const pos: number[] = [];
    for (let i = 0; i < count; i++) {
      pos.push(
        (Math.random() - 0.5) * 500,
        (Math.random() - 0.5) * 300,
        (Math.random() - 0.5) * 500
      );
    }
    return new Float32Array(pos);
  }, [count]);

  useFrame((state) => {
    if (dustRef.current) {
      dustRef.current.rotation.y = state.clock.getElapsedTime() * 0.005;
      dustRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.01) * 0.05;
    }
  });

  return (
    <points ref={dustRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={glowTexture}
        color={color}
        size={0.3}
        transparent
        opacity={0.3}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
        alphaTest={0.01}
        depthWrite={false}
      />
    </points>
  );
}
