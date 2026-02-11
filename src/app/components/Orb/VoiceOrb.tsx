"use client";

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// Simple 3D noise function (inline implementation)
const createNoise3D = () => {
  const grad3 = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
  ];
  
  const p: number[] = [];
  for (let i = 0; i < 256; i += 1) {
    p[i] = Math.floor(Math.random() * 256);
  }
  const perm: number[] = [];
  for (let i = 0; i < 512; i += 1) {
    perm[i] = p[i & 255];
  }
  
  const dot = (g: number[], x: number, y: number, z: number) => {
    return g[0]*x + g[1]*y + g[2]*z;
  };
  
  return (x: number, y: number, z: number) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    
    const u = x * x * x * (x * (x * 6 - 15) + 10);
    const v = y * y * y * (y * (y * 6 - 15) + 10);
    const w = z * z * z * (z * (z * 6 - 15) + 10);
    
    const A = perm[X] + Y;
    const AA = perm[A] + Z;
    const AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y;
    const BA = perm[B] + Z;
    const BB = perm[B + 1] + Z;
    
    const lerp = (a: number, b: number, t: number) => a + t * (b - a);
    
    return lerp(
      lerp(
        lerp(dot(grad3[perm[AA] % 12], x, y, z),
             dot(grad3[perm[BA] % 12], x-1, y, z), u),
        lerp(dot(grad3[perm[AB] % 12], x, y-1, z),
             dot(grad3[perm[BB] % 12], x-1, y-1, z), u), v),
      lerp(
        lerp(dot(grad3[perm[AA+1] % 12], x, y, z-1),
             dot(grad3[perm[BA+1] % 12], x-1, y, z-1), u),
        lerp(dot(grad3[perm[AB+1] % 12], x, y-1, z-1),
             dot(grad3[perm[BB+1] % 12], x-1, y-1, z-1), u), v), w);
  };
};

interface VoiceOrbProps {
  isListening?: boolean;
  onToggleListening?: () => void;
  color?: string;
  glowColor?: string;
  size?: number;
}

export default function VoiceOrb({ 
  isListening = false,
  onToggleListening,
  color = '#3b82f6',
  glowColor = '#60a5fa',
  size = 300
}: VoiceOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string>('');
  
  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const orbRef = useRef<THREE.Mesh | null>(null);
  const glowRef = useRef<THREE.Mesh | null>(null);
  const originalPositionsRef = useRef<Float32Array | null>(null);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, size / size, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true 
    });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    // Create orb geometry with high detail for smooth deformation
    const geometry = new THREE.IcosahedronGeometry(2, 5);
    const positions = geometry.attributes.position.array as Float32Array;
    originalPositionsRef.current = new Float32Array(positions);

    // Create custom shader material with animated gradient
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color1: { value: new THREE.Color(color) },
        color2: { value: new THREE.Color(color).multiplyScalar(0.3) },
        color3: { value: new THREE.Color(color).multiplyScalar(0.6) },
        audioLevel: { value: 0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color1;
        uniform vec3 color2;
        uniform vec3 color3;
        uniform float audioLevel;
        
        varying vec3 vNormal;
        varying vec3 vPosition;
        
        void main() {
          // Create animated gradient based on position and time
          float gradient = sin(vPosition.y * 2.0 + time) * 0.5 + 0.5;
          float gradient2 = cos(vPosition.x * 2.0 - time * 0.7) * 0.5 + 0.5;
          float gradient3 = sin(vPosition.z * 2.0 + time * 0.5) * 0.5 + 0.5;
          
          // Combine gradients
          vec3 mixedColor = mix(color1, color2, gradient);
          mixedColor = mix(mixedColor, color3, gradient2 * gradient3);
          
          // Add Fresnel effect (glow on edges)
          vec3 viewDirection = normalize(cameraPosition - vPosition);
          float fresnel = pow(1.0 - abs(dot(viewDirection, vNormal)), 2.5);
          
          // Brighten based on audio
          float brightness = 1.0 + audioLevel * 0.5;
          mixedColor *= brightness;
          
          // Add edge glow
          mixedColor += color1 * fresnel * (0.5 + audioLevel * 0.5);
          
          gl_FragColor = vec4(mixedColor, 0.9);
        }
      `,
      transparent: true
    });

    const orb = new THREE.Mesh(geometry, material);
    scene.add(orb);

    // Add outer glow layer
    const glowGeometry = new THREE.IcosahedronGeometry(2.2, 4);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(glowColor),
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glow);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(new THREE.Color(color), 1, 100);
    pointLight.position.set(0, 0, 10);
    scene.add(pointLight);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    orbRef.current = orb;
    glowRef.current = glow;

    return () => {
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [color, glowColor, size]);

  // Setup audio context and microphone
  useEffect(() => {
    if (!isListening) {
      // Cleanup audio
      if (microphoneRef.current) {
        microphoneRef.current.disconnect();
        microphoneRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setAudioLevel(0);
      return;
    }

    const setupAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        
        const microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        microphoneRef.current = microphone;
        
        setError('');
      } catch (err) {
        setError('Microphone access denied');
        console.error('Error accessing microphone:', err);
      }
    };

    setupAudio();

    return () => {
      if (microphoneRef.current) {
        microphoneRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isListening]);

  // Animation loop
  useEffect(() => {
    const noise3D = createNoise3D();
    let time = 0;

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      time += 0.005;

      // Get audio level
      let level = 0;
      if (analyserRef.current && isListening) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        level = average / 255;
        setAudioLevel(level);
      }

      // Update orb
      if (orbRef.current && originalPositionsRef.current) {
        const geometry = orbRef.current.geometry;
        const positions = geometry.attributes.position.array as Float32Array;
        const originalPositions = originalPositionsRef.current;

        // Base deformation intensity
        const baseIntensity = 0.15;
        const audioIntensity = level * 0.5;
        const totalIntensity = baseIntensity + audioIntensity;

        // Deform vertices using noise
        for (let i = 0; i < positions.length; i += 3) {
          const x = originalPositions[i];
          const y = originalPositions[i + 1];
          const z = originalPositions[i + 2];

          // Get noise value
          const noiseValue = noise3D(
            x * 1.5 + time,
            y * 1.5 + time,
            z * 1.5 + time
          );

          // Calculate offset based on noise and audio
          const offset = noiseValue * totalIntensity;

          // Normalize and apply offset
          const length = Math.sqrt(x * x + y * y + z * z);
          positions[i] = x + (x / length) * offset;
          positions[i + 1] = y + (y / length) * offset;
          positions[i + 2] = z + (z / length) * offset;
        }

        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();

        // Rotate orb slowly
        orbRef.current.rotation.y += 0.001;
        orbRef.current.rotation.x += 0.0005;

        // Pulse scale based on audio
        const scale = 1 + level * 0.15;
        orbRef.current.scale.set(scale, scale, scale);

        // Update shader uniforms
        const material = orbRef.current.material as THREE.ShaderMaterial;
        if (material.uniforms) {
          material.uniforms.time.value = time;
          material.uniforms.audioLevel.value = level;
        }
      }

      // Update glow
      if (glowRef.current) {
        glowRef.current.rotation.y += 0.002;
        glowRef.current.rotation.x += 0.001;
        
        const glowScale = 1 + level * 0.2;
        glowRef.current.scale.set(glowScale, glowScale, glowScale);
        
        const glowMaterial = glowRef.current.material as THREE.MeshBasicMaterial;
        glowMaterial.opacity = 0.2 + level * 0.3;
      }

      // Render scene
      if (sceneRef.current && cameraRef.current && rendererRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isListening]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div 
        ref={containerRef} 
        style={{ 
          width: size, 
          height: size,
          cursor: onToggleListening ? 'pointer' : 'default'
        }}
        onClick={onToggleListening}
      />
      
      {error && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#ff006e',
          fontSize: '0.75rem'
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
