"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type HelixParticle = {
  readonly basePos: THREE.Vector3;
  readonly currentPos: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly color: number;
  readonly size: number;
};

type AmbientParticle = {
  readonly pos: THREE.Vector3;
  readonly velocity: THREE.Vector3;
  readonly color: number;
  readonly size: number;
};

type DNAHelix = {
  readonly particles: HelixParticle[];
  readonly update: (time: number) => void;
};

const PARTICLES_PER_HELIX = 300;
const AMBIENT_COUNT = 550;
const HELIX_LENGTH = 320;

function createDNAHelix(offset: THREE.Vector3, speed: number, radius: number): DNAHelix {
  const particles: HelixParticle[] = [];

  for (let i = 0; i < PARTICLES_PER_HELIX; i += 1) {
    const t = i / PARTICLES_PER_HELIX;
    const angle = t * Math.PI * 14;
    const x = (t - 0.5) * HELIX_LENGTH;

    const y1 = Math.cos(angle) * radius;
    const z1 = Math.sin(angle) * radius;
    const y2 = Math.cos(angle + Math.PI) * radius;
    const z2 = Math.sin(angle + Math.PI) * radius;

    particles.push({
      basePos: new THREE.Vector3(x, y1, z1),
      currentPos: new THREE.Vector3(),
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01),
      color: Math.random() < 0.15 ? 0x00ff41 : 0x666666,
      size: 4 + Math.random() * 3
    });

    particles.push({
      basePos: new THREE.Vector3(x, y2, z2),
      currentPos: new THREE.Vector3(),
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01),
      color: Math.random() < 0.15 ? 0x00ff41 : 0xffdd44,
      size: 4 + Math.random() * 3
    });
  }

  const update = (time: number) => {
    particles.forEach((particle) => {
      const rotatedY = particle.basePos.y * Math.cos(time * speed) - particle.basePos.z * Math.sin(time * speed);
      const rotatedZ = particle.basePos.y * Math.sin(time * speed) + particle.basePos.z * Math.cos(time * speed);

      particle.currentPos.x = particle.basePos.x + offset.x + Math.sin(time + particle.basePos.x * 0.1) * 0.3;
      particle.currentPos.y = rotatedY + offset.y + particle.velocity.y * Math.sin(time);
      particle.currentPos.z = rotatedZ + offset.z + particle.velocity.z * Math.cos(time);
    });
  };

  return { particles, update };
}

function createAmbientParticles(): AmbientParticle[] {
  return Array.from({ length: AMBIENT_COUNT }, (_, index) => {
    const isBackgroundParticle = index > 200;
    return {
      pos: new THREE.Vector3((Math.random() - 0.5) * 400, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 100),
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.02),
      color: isBackgroundParticle ? (Math.random() < 0.5 ? 0x333333 : 0x444444) : Math.random() < 0.3 ? 0x00ff41 : 0x4a90e2,
      size: isBackgroundParticle ? 0.8 + Math.random() * 1 : 1.5 + Math.random() * 1.5
    };
  });
}

function updateAmbientParticle(particle: AmbientParticle) {
  particle.pos.add(particle.velocity);

  if (Math.abs(particle.pos.x) > 200) {
    particle.velocity.x *= -1;
  }
  if (Math.abs(particle.pos.y) > 60) {
    particle.velocity.y *= -1;
  }
  if (Math.abs(particle.pos.z) > 50) {
    particle.velocity.z *= -1;
  }
}

type ReferenceDnaSceneProps = {
  readonly className?: string;
  readonly reversed?: boolean;
  readonly style?: import("react").CSSProperties;
};

export function ReferenceDnaScene({ className, reversed = false, style }: ReferenceDnaSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = containerRef.current;
    if (!wrap) {
      return;
    }

    if (!(window as typeof window & { WebGLRenderingContext?: unknown }).WebGLRenderingContext) {
      console.warn("WebGL not supported, using fallback background");
      return;
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    if (reversed) {
      scene.scale.x = -1;
    }
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.z = 40;

    const helices: DNAHelix[] = [
      createDNAHelix(new THREE.Vector3(0, 10, -10), 0.25, 5),
      createDNAHelix(new THREE.Vector3(0, -8, -6), 0.3, 4.5),
      createDNAHelix(new THREE.Vector3(0, 0, -15), 0.28, 5.5)
    ];

    const ambientParticles = createAmbientParticles();

    const particleGeo = new THREE.BufferGeometry();
    const totalParticles = helices.reduce((sum, helix) => sum + helix.particles.length, 0) + ambientParticles.length;
    const positions = new Float32Array(totalParticles * 3);
    const colors = new Float32Array(totalParticles * 3);
    const sizes = new Float32Array(totalParticles);

    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    particleGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const vertexShader = `
      precision highp float;
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / max(-mvPosition.z, 0.1));
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      precision highp float;
      varying vec3 vColor;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);
        float alpha = smoothstep(0.5, 0.0, dist);
        float glow = pow(alpha, 1.2);
        gl_FragColor = vec4(vColor * glow, glow * 0.8);
      }
    `;

    const particleMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true
    });

    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    const MAX_CONNECTIONS = 1200;
    const linePositions = new Float32Array(MAX_CONNECTIONS * 2 * 3);
    const lineColors = new Float32Array(MAX_CONNECTIONS * 2 * 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3).setUsage(THREE.DynamicDrawUsage));
    lineGeo.setAttribute("color", new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage));
    lineGeo.setDrawRange(0, 0);

    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });

    const lineSystem = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lineSystem);

    const clock = new THREE.Clock();

    const animate = () => {
      const time = clock.getElapsedTime();

      helices.forEach((helix) => helix.update(time));
      ambientParticles.forEach(updateAmbientParticle);

const allParticles = [...helices.flatMap((helix) => helix.particles), ...ambientParticles] as Array<
  HelixParticle | AmbientParticle
>;

      let idx = 0;
      allParticles.forEach((particle) => {
        const position = "currentPos" in particle ? (particle as HelixParticle).currentPos : (particle as AmbientParticle).pos;
        positions[idx * 3] = position.x;
        positions[idx * 3 + 1] = position.y;
        positions[idx * 3 + 2] = position.z;

        const color = new THREE.Color(particle.color);
        colors[idx * 3] = color.r;
        colors[idx * 3 + 1] = color.g;
        colors[idx * 3 + 2] = color.b;
        sizes[idx] = particle.size;
        idx += 1;
      });

      particleGeo.attributes.position.needsUpdate = true;
      particleGeo.attributes.color.needsUpdate = true;

      let lineIdx = 0;
      const CONNECT_DIST = 22;
      const connectDistSq = CONNECT_DIST * CONNECT_DIST;

      for (let i = 0; i < allParticles.length && lineIdx < MAX_CONNECTIONS; i += 1) {
        const first = allParticles[i];
        const firstPos = (first as HelixParticle).currentPos ?? (first as AmbientParticle).pos;
        let connections = 0;

        for (let j = i + 1; j < allParticles.length && connections < 3 && lineIdx < MAX_CONNECTIONS; j += 1) {
          const second = allParticles[j];
          const secondPos = (second as HelixParticle).currentPos ?? (second as AmbientParticle).pos;

          const dx = firstPos.x - secondPos.x;
          const dy = firstPos.y - secondPos.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < connectDistSq) {
            const dist = Math.sqrt(distSq);
            const strength = 1.0 - dist / CONNECT_DIST;
            const base = lineIdx * 6;

            linePositions[base] = firstPos.x;
            linePositions[base + 1] = firstPos.y;
            linePositions[base + 2] = firstPos.z;
            linePositions[base + 3] = secondPos.x;
            linePositions[base + 4] = secondPos.y;
            linePositions[base + 5] = secondPos.z;

            const blended = new THREE.Color().lerpColors(new THREE.Color(first.color), new THREE.Color(second.color), 0.5);

            lineColors[base] = blended.r * strength;
            lineColors[base + 1] = blended.g * strength;
            lineColors[base + 2] = blended.b * strength;
            lineColors[base + 3] = blended.r * strength;
            lineColors[base + 4] = blended.g * strength;
            lineColors[base + 5] = blended.b * strength;

            lineIdx += 1;
            connections += 1;
          }
        }
      }

      lineGeo.setDrawRange(0, lineIdx * 2);
      lineGeo.attributes.position.needsUpdate = true;
      lineGeo.attributes.color.needsUpdate = true;

      renderer.render(scene, camera);
    };

    renderer.setAnimationLoop(animate);

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.setAnimationLoop(null);
      renderer.dispose();
      particleGeo.dispose();
      lineGeo.dispose();
      particleMat.dispose();
      lineMat.dispose();

      if (wrap.contains(renderer.domElement)) {
        wrap.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className={className ?? "dna-scene"} style={style} />;
}
