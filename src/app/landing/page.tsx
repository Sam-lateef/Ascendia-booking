"use client";

import { useTranslations } from '@/lib/i18n/TranslationProvider';

import { useEffect, useState, useRef } from "react";
import Script from "next/script";

export default function LandingPage() {
  const tCommon = useTranslations('common');
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [showDots, setShowDots] = useState(0);
  const [emailSent, setEmailSent] = useState(false);
  const [pulseActive, setPulseActive] = useState(false);
  const pulseRef = useRef(false);
  const pulseStartTime = useRef(0);
  const vantaRef = useRef<any>(null);

  const phrases = [
    "CENTRALIZE",
    "OPTIMIZE",
    "CUSTOMIZE",
    "ORGANIZE",
    "MEMORIZE",
    "ACTUALIZE",
    "COMING SOON"
  ];

  // Typewriter effect
  useEffect(() => {
    const currentPhrase = phrases[phraseIndex];
    const typingSpeed = 30; // Very fast typing - same speed for both typing and deleting
    const pauseTime = 4000; // Wait for one full underscore flash cycle (4 seconds) whether typing or deleting

    const timer = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        if (displayedText.length < currentPhrase.length) {
          setDisplayedText(currentPhrase.slice(0, displayedText.length + 1));
        } else {
          // Finished typing, wait then start deleting
          setTimeout(() => setIsDeleting(true), pauseTime);
        }
      } else {
        // Deleting
        if (displayedText.length > 0) {
          setDisplayedText(displayedText.slice(0, -1));
        } else {
          // Finished deleting, move to next phrase
          setIsDeleting(false);
          setPhraseIndex((phraseIndex + 1) % phrases.length);
        }
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, phraseIndex]);

  // Loading dots animation
  useEffect(() => {
    const interval = setInterval(() => {
      setShowDots((prev) => (prev + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Handle email submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Email submitted - pulse starting');
    setEmailSent(true);
    setPulseActive(true);
    pulseRef.current = true;
    pulseStartTime.current = performance.now();
    
    // Reset after animation - longer to allow complete fade out
    setTimeout(() => {
      console.log('Pulse ending');
      setPulseActive(false);
      setEmailSent(false);
      pulseRef.current = false;
      pulseStartTime.current = 0;
    }, 4500);
  };

  // Initialize Neural Network WebGL Background
  useEffect(() => {
    const wrap = document.getElementById('neural-bg');
    if (!wrap || !window.WebGLRenderingContext) {
      console.warn('WebGL not supported, using fallback background');
      return;
    }

    // Wait for THREE.js to load
    const initThree = () => {
      // @ts-ignore - THREE.js loaded via CDN
      const THREE = window.THREE;
      if (!THREE) {
        console.warn('THREE.js not loaded yet');
        return;
      }

      try {

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: false
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x1a1a1a, 1); // Dark gray background
    
    // Suppress console warnings for shader compilation (they're non-critical)
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.warn = (...args) => {
      const msg = String(args[0] || '');
      if (msg.includes('THREE.WebGLProgram') || 
          msg.includes('Shader Error') || 
          msg.includes('VALIDATE_STATUS') ||
          msg.includes('Vertex shader is not compiled')) {
        // Suppress THREE.js shader warnings that don't affect functionality
        return;
      }
      originalWarn.apply(console, args);
    };
    
    console.error = (...args) => {
      const msg = String(args[0] || '');
      if (msg.includes('THREE.WebGLProgram') || 
          msg.includes('Shader Error') || 
          msg.includes('VALIDATE_STATUS') ||
          msg.includes('Vertex shader is not compiled')) {
        // Suppress THREE.js shader errors that don't affect functionality
        return;
      }
      originalError.apply(console, args);
    };
    
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10);
    camera.position.z = 1.2;

    // Config - mostly gray with sparse bright green accents
    const POINT_COUNT = window.innerWidth < 800 ? 50 : 120;
    const SPEED = 0.4; // Slower, more fluid movement
    let CONNECT_DIST = 0.2; // Connection distance - can be modified during pulse
    const POINT_SIZE = 5;
    const LINE_OPACITY = 0.28; // More visible lines
    const GREEN_RATIO = 0.08; // Only 8% of points will be bright green
    const GRAY_COLOR = 0x666666; // Medium gray for most points
    const YELLOW_COLOR = 0xffdd44; // Warm yellow for lines
    const GREEN_COLOR = 0x00ff41; // Bright green accent

    // Points setup
    const positions = new Float32Array(POINT_COUNT * 3);
    const velocities = new Float32Array(POINT_COUNT * 3);
    const sizes = new Float32Array(POINT_COUNT);
    const colors = new Float32Array(POINT_COUNT * 3);
    const isGreen = new Float32Array(POINT_COUNT); // Track which points are green
    const spread = 1.25;

    for (let i = 0; i < POINT_COUNT; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * spread;
      positions[i * 3 + 1] = (Math.random() * 2 - 1) * spread * (window.innerHeight / window.innerWidth);
      positions[i * 3 + 2] = (Math.random() * 1 - 0.5) * 0.08;
      velocities[i * 3] = (Math.random() * 2 - 1) * 0.0015;
      velocities[i * 3 + 1] = (Math.random() * 2 - 1) * 0.0015;
      velocities[i * 3 + 2] = (Math.random() * 2 - 1) * 0.0004;
      sizes[i] = POINT_SIZE * (0.5 + Math.random() * 0.8);
      
      // Assign color - mostly gray, few green
      const greenPoint = Math.random() < GREEN_RATIO;
      isGreen[i] = greenPoint ? 1.0 : 0.0;
      const col = greenPoint ? new THREE.Color(GREEN_COLOR) : new THREE.Color(GRAY_COLOR);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    // Points material
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const vertex = `
attribute float size;
attribute vec3 color;
varying vec3 vColor;
varying float vSize;
void main() {
  vColor = color;
  vSize = size;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vSize * (300.0 / -mv.z);
}
`;
    const fragment = `
varying vec3 vColor;
varying float vSize;
void main() {
  vec2 uv = gl_PointCoord.xy - 0.5;
  float dist = length(uv);
  float alpha = smoothstep(0.6, 0.0, dist);
  float glow = pow(alpha, 1.3);
  gl_FragColor = vec4(vColor * glow, glow * 0.7);
}
`;

    const mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true
    });

    // Check for shader compilation errors
    if (mat.program) {
      const gl = renderer.getContext();
      const program = mat.program.program;
      if (program && gl.getProgramParameter(program, gl.LINK_STATUS) === false) {
        console.warn('Shader program linking issue (non-critical):', gl.getProgramInfoLog(program));
      }
    }

    const points = new THREE.Points(geom, mat);
    scene.add(points);

    // Lines setup
    const MAX_CONN = POINT_COUNT * 3;
    const linePos = new Float32Array(MAX_CONN * 2 * 3);
    const lineColors = new Float32Array(MAX_CONN * 2 * 3);
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.BufferAttribute(linePos, 3).setUsage(THREE.DynamicDrawUsage));
    lineGeom.setAttribute('color', new THREE.BufferAttribute(lineColors, 3).setUsage(THREE.DynamicDrawUsage));
    lineGeom.setDrawRange(0, 0);

    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: LINE_OPACITY,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const lines = new THREE.LineSegments(lineGeom, lineMat);
    scene.add(lines);

    // Store reference to material for pulse animation
    let baseMaterialOpacity = LINE_OPACITY;

    function sqrDist(ax: number, ay: number, bx: number, by: number) {
      const dx = ax - bx, dy = ay - by;
      return dx * dx + dy * dy;
    }

    let last = performance.now(), tick = 0;
    function animate() {
      const now = performance.now(), dt = Math.min(50, now - last) / 1000;
      last = now;
      tick += dt * SPEED;

      // Update pulse intensity using ref - check ref value on each frame
      let pulseIntensity = 1.0;
      let materialOpacityMultiplier = 1.0;
      let connectionMultiplier = 1.0;
      
      if (pulseRef.current && pulseStartTime.current > 0) {
        // Calculate elapsed time since pulse started (in seconds)
        const elapsed = (now - pulseStartTime.current) / 1000;
        const pulseDuration = 4.2; // Total duration of one pulse cycle
        
        // Calculate progress (0 to 1) - no looping!
        const progress = Math.min(elapsed / pulseDuration, 1.0);
        
        let smoothPulse;
        // Split into rise (20%) and fall (80%) phases for longer fade
        if (progress < 0.2) {
          // Fast rise - 20% of cycle
          const riseFraction = progress / 0.2;
          smoothPulse = Math.pow(riseFraction, 0.7); // Quick to peak
        } else if (progress < 1.0) {
          // Very slow fade - 80% of cycle with cubic ease out
          const fallFraction = (progress - 0.2) / 0.8;
          // Cubic ease out - very smooth to zero
          smoothPulse = 1.0 - Math.pow(fallFraction, 3);
        } else {
          // Pulse complete - return to baseline
          smoothPulse = 0.0;
        }
        
        // Different parameters fade at different rates for smooth, staggered return
        const intensityFade = smoothPulse; // Fastest fade
        const opacityFade = Math.pow(smoothPulse, 0.8); // Medium fade
        const connectionFade = Math.pow(smoothPulse, 0.6); // Slowest fade
        
        pulseIntensity = 1.0 + intensityFade * 1.5; // 1.0 to 2.5
        materialOpacityMultiplier = 1.0 + opacityFade * 1.2; // 1.0 to 2.2
        connectionMultiplier = 1.0 + connectionFade * 0.4; // Increase connection distance
        
        // Update material opacity for more visible effect
        lineMat.opacity = Math.min(1.0, baseMaterialOpacity * materialOpacityMultiplier);
        
        // Increase connection distance during pulse
        CONNECT_DIST = 0.2 * connectionMultiplier;
      } else {
        lineMat.opacity = baseMaterialOpacity;
        CONNECT_DIST = 0.2;
      }

      for (let i = 0; i < POINT_COUNT; i++) {
        const ix = i * 3, iy = ix + 1, iz = ix + 2;
        positions[ix] += velocities[ix] * dt * 60 * SPEED;
        positions[iy] += velocities[iy] * dt * 60 * SPEED;
        positions[iz] += velocities[iz] * dt * 60 * SPEED;
        positions[ix] += Math.sin(tick * (0.2 + i % 7 * 0.03) + i) * 0.0004 * SPEED;
        positions[iy] += Math.cos(tick * (0.15 + i % 11 * 0.02) + i * 1.3) * 0.00035 * SPEED;
        if (positions[ix] > spread) positions[ix] = -spread;
        if (positions[ix] < -spread) positions[ix] = spread;
        const ySpread = spread * (window.innerHeight / window.innerWidth);
        if (positions[iy] > ySpread) positions[iy] = -ySpread;
        if (positions[iy] < -ySpread) positions[iy] = ySpread;
      }

      geom.attributes.position.needsUpdate = true;

      // Lines connections - green lines between green points, yellow for others
      let seg = 0;
      const maxSeg = MAX_CONN;
      const connThreshold = CONNECT_DIST; // This now changes during pulse
      const connThresholdSq = connThreshold * connThreshold;
      const yellowCol = new THREE.Color(YELLOW_COLOR);
      const greenCol = new THREE.Color(GREEN_COLOR);
      
      // During pulse, also make points brighter
      const pointOpacity = pulseRef.current ? materialOpacityMultiplier : 1.0;

      for (let a = 0; a < POINT_COUNT; a++) {
        const ax = positions[a * 3], ay = positions[a * 3 + 1];
        const aGreen = isGreen[a] > 0.5;
        let localConn = 0;
        for (let b = a + 1; b < POINT_COUNT; b++) {
          if (seg >= maxSeg) break;
          const bx = positions[b * 3], by = positions[b * 3 + 1];
          const bGreen = isGreen[b] > 0.5;
          const d2 = sqrDist(ax, ay, bx, by);
          if (d2 <= connThresholdSq) {
            const w = 1.0 - (Math.sqrt(d2) / connThreshold);
            const base = seg * 2 * 3;
            linePos[base] = ax; linePos[base + 1] = ay; linePos[base + 2] = positions[a * 3 + 2];
            linePos[base + 3] = bx; linePos[base + 4] = by; linePos[base + 5] = positions[b * 3 + 2];
            
            // Line color: green if either point is green, otherwise yellow
            const lineColor = (aGreen || bGreen) ? greenCol : yellowCol;
            const baseIntensity = (aGreen && bGreen) ? 1.0 : (aGreen || bGreen) ? 0.6 : 0.3;
            
            // Apply pulse intensity - gentle brightness increase
            const finalIntensity = baseIntensity * pulseIntensity;
            
            // Clamp to prevent over-bright values - more conservative
            const clampedIntensity = Math.min(finalIntensity, 3.5);
            
            lineColors[base] = lineColor.r * w * clampedIntensity;
            lineColors[base + 1] = lineColor.g * w * clampedIntensity;
            lineColors[base + 2] = lineColor.b * w * clampedIntensity;
            lineColors[base + 3] = lineColor.r * w * clampedIntensity;
            lineColors[base + 4] = lineColor.g * w * clampedIntensity;
            lineColors[base + 5] = lineColor.b * w * clampedIntensity;
            seg++;
            localConn++;
            if (localConn > 5) break;
          }
        }
      }

      lineGeom.setDrawRange(0, seg * 2);
      lineGeom.attributes.position.needsUpdate = true;
      lineGeom.attributes.color.needsUpdate = true;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (wrap && renderer.domElement && wrap.contains(renderer.domElement)) {
        wrap.removeChild(renderer.domElement);
      }
      // Restore original console methods
      console.warn = originalWarn;
      console.error = originalError;
    };
  } catch (error) {
    console.error('Error initializing neural network background:', error);
  }
};

    // Check if THREE is already loaded
    // @ts-ignore
    if (window.THREE) {
      initThree();
    } else {
      // Wait for THREE.js to load
      const checkThree = setInterval(() => {
        // @ts-ignore
        if (window.THREE) {
          clearInterval(checkThree);
          initThree();
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => clearInterval(checkThree), 5000);

      return () => clearInterval(checkThree);
    }
  }, []);

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js"
        strategy="beforeInteractive"
        onError={(e) => {
          console.error('Failed to load THREE.js:', e);
        }}
      />

      <div className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
        <div
          id="neural-bg"
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 0 }}
        />

        <div
          className="relative z-10 flex flex-col h-full"
        >
          {/* Ascendia AI - Fixed position, moved more to the right */}
          <div
            style={{
              position: 'absolute',
              left: '15%',
              top: '40%',
              transform: 'translateY(-50%)',
              fontSize: '3rem',
              color: '#cccccc',
              fontWeight: '400',
              letterSpacing: '0.05em',
              fontFamily: 'Orbitron, sans-serif',
              whiteSpace: 'nowrap'
            }}
          >
            Ascendia AI
          </div>

          {/* Typed text with underscore - appears to the right of Ascendia AI */}
          <div
            style={{
              position: 'absolute',
              left: 'calc(15% + 280px)', // Position after Ascendia AI with proper spacing
              top: '40%',
              transform: 'translateY(-50%)',
              fontSize: '3rem',
              color: '#00ff41',
              fontWeight: '400',
              fontFamily: 'Orbitron, sans-serif',
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'baseline'
            }}
          >
            <span>{displayedText}</span>
            <span
              className="cursor-animate"
              style={{ color: 'var(--bright-green)', marginLeft: '2px' }}
            >
              _
            </span>
          </div>

          {/* Tagline - positioned below Ascendia AI, on the right side */}
          <div
            className="absolute"
            style={{
              top: '52%',
              right: '12%',
              color: 'rgba(153, 153, 153, 0.8)',
              letterSpacing: '0.1em',
              fontSize: '1.5rem',
              fontFamily: 'Orbitron, sans-serif',
              textAlign: 'left',
              maxWidth: '600px',
              lineHeight: '1.4'
            }}
          >
            It's easier when you can talk to your apps and data.
          </div>

          {/* inTest with loading dots - positioned above email input */}
          <div
            className="absolute"
            style={{
              bottom: '23vh',
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'rgba(153, 153, 153, 0.5)',
              letterSpacing: '0.1em',
              fontSize: '0.875rem',
              fontFamily: 'Orbitron, sans-serif',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span>inTest</span>
            <span style={{ width: '3ch', display: 'inline-block', textAlign: 'left' }}>
              {'.'.repeat(showDots)}
            </span>
          </div>

          {/* Email input with submit button - transparent */}
          <form 
            onSubmit={handleSubmit}
            className="w-full max-w-md px-4 mx-auto" 
            style={{ position: 'absolute', bottom: '15vh', left: '50%', transform: 'translateX(-50%)' }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="email"
                placeholder={tCommon('tell_me_when_its_done')}
                className="w-full px-6 py-4 text-center focus:outline-none transition-all"
                style={{
                  background: 'rgba(45, 45, 45, 0.3)',
                  color: '#cccccc',
                  border: '1px solid rgba(62, 62, 62, 0.5)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.1em',
                  fontFamily: 'Orbitron, sans-serif',
                  backdropFilter: 'blur(4px)',
                  paddingRight: '3.5rem'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#00ff41';
                  e.currentTarget.style.background = 'rgba(45, 45, 45, 0.4)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(62, 62, 62, 0.5)';
                  e.currentTarget.style.background = 'rgba(45, 45, 45, 0.3)';
                }}
                required
              />
              <button
                type="submit"
                className="absolute right-2 transition-all duration-300"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  color: emailSent ? '#00ff41' : '#ffdd44',
                  padding: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => {
                  if (!emailSent) e.currentTarget.style.color = '#00ff41';
                }}
                onMouseLeave={(e) => {
                  if (!emailSent) e.currentTarget.style.color = '#ffdd44';
                }}
              >
                @
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@300;400;500;600;700&family=Rajdhani:wght@400;500;600;700&display=swap');

        :root {
          --bright-green: #00ff41;
        }

        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
        }

        @keyframes cursor-fade {
          0%, 54% {
            color: var(--bright-green);
            opacity: 1;
          }
          69% {
            color: #2d2d2d;
            opacity: 0.3;
          }
          90% {
            color: #2d2d2d;
            opacity: 0.3;
          }
          100% {
            color: var(--bright-green);
            opacity: 1;
          }
        }

        .cursor-animate {
          animation: cursor-fade 4s ease-in-out infinite;
        }

        input::placeholder {
          color: #666666;
          opacity: 0.8;
        }

        input::-webkit-input-placeholder {
          color: #666666;
          opacity: 0.8;
        }

        input::-moz-placeholder {
          color: #666666;
          opacity: 0.8;
        }
      `}</style>
    </>
  );
}

