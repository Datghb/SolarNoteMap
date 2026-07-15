import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function Sun() {
  const sunRef = useRef<THREE.Mesh>(null);
  const coronaRef = useRef<THREE.Mesh>(null);
  const flareRef = useRef<THREE.Points>(null);

  const glowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.55)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.12)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, []);

  // Create procedural sun texture
  const sunTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base gradient
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    gradient.addColorStop(0, '#FFFFFF');
    gradient.addColorStop(0.3, '#FFF5DC');
    gradient.addColorStop(0.6, '#FFD700');
    gradient.addColorStop(0.8, '#FF8C00');
    gradient.addColorStop(1, '#FF4500');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    // Add solar granulation
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 2 + Math.random() * 10;
      const brightness = Math.random() > 0.5 ? 'rgba(255, 255, 200, 0.3)' : 'rgba(255, 100, 0, 0.2)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = brightness;
      ctx.fill();
    }

    // Add sunspots
    for (let i = 0; i < 8; i++) {
      const x = 100 + Math.random() * 312;
      const y = 100 + Math.random() * 312;
      const r = 5 + Math.random() * 20;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100, 50, 0, 0.4)';
      ctx.fill();
    }

    return new THREE.CanvasTexture(canvas);
  }, []);

  // Create corona particles
  const coronaParticles = useMemo(() => {
    const particles = [];
    const count = 2000;
    
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 5.5 + Math.random() * 3;
      
      particles.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
    }
    
    return new Float32Array(particles);
  }, []);

  const coronaSizes = useMemo(() => {
    const sizes = [];
    for (let i = 0; i < 2000; i++) {
      sizes.push(0.05 + Math.random() * 0.15);
    }
    return new Float32Array(sizes);
  }, []);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();

    if (sunRef.current) {
      sunRef.current.rotation.y += delta * 0.05;
    }

    if (coronaRef.current) {
      coronaRef.current.rotation.y -= delta * 0.02;
      coronaRef.current.rotation.x = Math.sin(time * 0.1) * 0.1;
    }

    if (flareRef.current) {
      flareRef.current.rotation.y += delta * 0.03;
      flareRef.current.rotation.z = Math.sin(time * 0.2) * 0.05;
      
      // Animate particle sizes
      const sizes = flareRef.current.geometry.attributes.size;
      for (let i = 0; i < sizes.count; i++) {
        sizes.array[i] = 0.05 + Math.sin(time * 2 + i * 0.1) * 0.05 + 0.1;
      }
      sizes.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Sun core */}
      <mesh ref={sunRef}>
        <sphereGeometry args={[5, 64, 64]} />
        <meshBasicMaterial map={sunTexture} />
      </mesh>

      {/* Inner glow */}
      <mesh scale={1.1}>
        <sphereGeometry args={[5, 32, 32]} />
        <meshBasicMaterial 
          color="#FF6B00" 
          transparent 
          opacity={0.58} 
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer corona */}
      <mesh ref={coronaRef} scale={1.3}>
        <sphereGeometry args={[5, 32, 32]} />
        <meshBasicMaterial 
          color="#FF4500" 
          transparent 
          opacity={0.24} 
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Solar flare particles */}
      <points ref={flareRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[coronaParticles, 3]}
          />
          <bufferAttribute
            attach="attributes-size"
            args={[coronaSizes, 1]}
          />
        </bufferGeometry>
        <pointsMaterial
          map={glowTexture}
          color="#FFD700"
          size={0.15}
          transparent
          opacity={0.82}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
          alphaTest={0.01}
          depthWrite={false}
        />
      </points>

      {/* Main light source */}
      <pointLight 
        color="#FFF5E1" 
        intensity={5.5} 
        distance={500} 
        decay={0.3}
        castShadow
      />

      {/* Secondary warm light */}
      <pointLight 
        color="#FF8C00" 
        intensity={2.2} 
        distance={300} 
        decay={0.5}
      />

      {/* Corona glow sprite */}
      <sprite scale={[30, 30, 1]}>
        <spriteMaterial
          map={glowTexture}
          color="#FFA500"
          transparent
          opacity={0.48}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      {/* Outer halo */}
      <sprite scale={[50, 50, 1]}>
        <spriteMaterial
          map={glowTexture}
          color="#FF6347"
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      {/* Lens flare effect */}
      <sprite scale={[15, 15, 1]} position={[3, 3, 0]}>
        <spriteMaterial
          map={glowTexture}
          color="#FFFFFF"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}
