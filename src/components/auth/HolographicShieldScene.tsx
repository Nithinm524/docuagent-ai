import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface HolographicShieldSceneProps {
  className?: string;
}

export const HolographicShieldScene: React.FC<HolographicShieldSceneProps> = ({ className = '' }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability
    const checkWebGL = () => {
      try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      } catch {
        return false;
      }
    };

    if (!checkWebGL()) {
      setWebGlSupported(false);
      return;
    }

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.2);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      container.appendChild(renderer.domElement);
    } catch (e) {
      console.warn('[HolographicShieldScene] WebGL initialization failed, fallback active:', e);
      setWebGlSupported(false);
      return;
    }

    // Root container for mouse parallax & floating sway
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // -------------------------------------------------------------
    // 2. CENTRAL GLOWING DOCUMENT CORE
    // -------------------------------------------------------------
    const docGroup = new THREE.Group();
    rootGroup.add(docGroup);

    // Document Body
    const docGeo = new THREE.BoxGeometry(1.3, 1.8, 0.12);
    const docMat = new THREE.MeshPhysicalMaterial({
      color: 0x083344,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.8,
      thickness: 0.5,
      transparent: true,
      opacity: 0.88
    });
    const docMesh = new THREE.Mesh(docGeo, docMat);
    docGroup.add(docMesh);

    // Glowing Document Wireframe Edges
    const docEdges = new THREE.EdgesGeometry(docGeo);
    const docLineMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.85
    });
    const docWireframe = new THREE.LineSegments(docEdges, docLineMat);
    docGroup.add(docWireframe);

    // Simulated Document Header Bar & Text Lines (Holographic Data Strips)
    const headerGeo = new THREE.PlaneGeometry(0.95, 0.12);
    const headerMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.8 });
    const headerMesh = new THREE.Mesh(headerGeo, headerMat);
    headerMesh.position.set(0, 0.62, 0.07);
    docGroup.add(headerMesh);

    const lineRows = [-0.35, -0.15, 0.05, 0.25, 0.45];
    lineRows.forEach((y, i) => {
      const lineGeo = new THREE.PlaneGeometry(i % 2 === 0 ? 0.9 : 0.75, 0.04);
      const lineMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x38bdf8 : 0x2dd4bf,
        transparent: true,
        opacity: 0.65
      });
      const lineMesh = new THREE.Mesh(lineGeo, lineMat);
      lineMesh.position.set(i % 2 === 0 ? 0 : -0.07, y, 0.07);
      docGroup.add(lineMesh);
    });

    // Inner Glowing Core Light
    const coreLight = new THREE.PointLight(0x00f2fe, 3.5, 6);
    coreLight.position.set(0, 0, 0);
    docGroup.add(coreLight);

    // -------------------------------------------------------------
    // 3. HOLOGRAPHIC GEODESIC SHIELD
    // -------------------------------------------------------------
    const shieldGroup = new THREE.Group();
    rootGroup.add(shieldGroup);

    // Translucent faceted crystal shield
    const shieldGeo = new THREE.IcosahedronGeometry(2.1, 1);
    const shieldMat = new THREE.MeshPhysicalMaterial({
      color: 0x0e7490,
      emissive: 0x0891b2,
      emissiveIntensity: 0.2,
      roughness: 0.2,
      metalness: 0.2,
      transmission: 0.88,
      transparent: true,
      opacity: 0.4,
      wireframe: false
    });
    const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    shieldGroup.add(shieldMesh);

    // Shield Wireframe Grid
    const shieldWireGeo = new THREE.WireframeGeometry(shieldGeo);
    const shieldWireMat = new THREE.LineBasicMaterial({
      color: 0x00f2fe,
      transparent: true,
      opacity: 0.45
    });
    const shieldWire = new THREE.LineSegments(shieldWireGeo, shieldWireMat);
    shieldGroup.add(shieldWire);

    // -------------------------------------------------------------
    // 4. ORBITING DOCUMENT PANELS
    // -------------------------------------------------------------
    const orbitingGroup = new THREE.Group();
    rootGroup.add(orbitingGroup);

    interface OrbitPanel {
      mesh: THREE.Group;
      radius: number;
      speed: number;
      angle: number;
      inclination: number;
    }

    const orbitPanels: OrbitPanel[] = [];
    const panelConfigs = [
      { radius: 2.7, speed: 0.45, startAngle: 0, inclination: 0.35, color: 0x22d3ee },
      { radius: 2.85, speed: -0.35, startAngle: 2.1, inclination: -0.4, color: 0x14b8a6 },
      { radius: 3.1, speed: 0.28, startAngle: 4.2, inclination: 0.15, color: 0x818cf8 }
    ];

    panelConfigs.forEach((cfg) => {
      const panel = new THREE.Group();

      const pGeo = new THREE.BoxGeometry(0.8, 1.05, 0.04);
      const pMat = new THREE.MeshPhysicalMaterial({
        color: 0x071b2f,
        emissive: cfg.color,
        emissiveIntensity: 0.25,
        transmission: 0.8,
        transparent: true,
        opacity: 0.65
      });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      panel.add(pMesh);

      const pEdges = new THREE.EdgesGeometry(pGeo);
      const pLineMat = new THREE.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.8 });
      panel.add(new THREE.LineSegments(pEdges, pLineMat));

      // Panel subtle badge
      const badgeGeo = new THREE.PlaneGeometry(0.5, 0.06);
      const badgeMat = new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.7 });
      const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
      badgeMesh.position.set(0, 0.35, 0.03);
      panel.add(badgeMesh);

      orbitingGroup.add(panel);
      orbitPanels.push({
        mesh: panel,
        radius: cfg.radius,
        speed: cfg.speed,
        angle: cfg.startAngle,
        inclination: cfg.inclination
      });
    });

    // -------------------------------------------------------------
    // 5. CONCENTRIC LUMINOUS RINGS
    // -------------------------------------------------------------
    const ringGroup = new THREE.Group();
    rootGroup.add(ringGroup);

    // Cyan Ring
    const ring1Geo = new THREE.TorusGeometry(3.05, 0.012, 16, 120);
    const ring1Mat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.75 });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.x = Math.PI * 0.38;
    ring1.rotation.y = Math.PI * 0.12;
    ringGroup.add(ring1);

    // Teal Ring
    const ring2Geo = new THREE.TorusGeometry(3.4, 0.01, 16, 120);
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x14b8a6, transparent: true, opacity: 0.6 });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = -Math.PI * 0.25;
    ring2.rotation.z = Math.PI * 0.2;
    ringGroup.add(ring2);

    // Violet Accent Ring
    const ring3Geo = new THREE.TorusGeometry(2.55, 0.008, 16, 100);
    const ring3Mat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.5 });
    const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
    ring3.rotation.y = Math.PI * 0.5;
    ring3.rotation.x = Math.PI * 0.15;
    ringGroup.add(ring3);

    // -------------------------------------------------------------
    // 6. FINE AMBIENT PARTICLE SWARM
    // -------------------------------------------------------------
    const particleCount = 420;
    const particleGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const c1 = new THREE.Color(0x00f2fe);
    const c2 = new THREE.Color(0x14b8a6);
    const c3 = new THREE.Color(0x818cf8);

    for (let i = 0; i < particleCount; i++) {
      const radius = 2.2 + Math.random() * 4.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const mixedColor = i % 3 === 0 ? c1 : i % 3 === 1 ? c2 : c3;
      colors[i * 3] = mixedColor.r;
      colors[i * 3 + 1] = mixedColor.g;
      colors[i * 3 + 2] = mixedColor.b;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    rootGroup.add(particles);

    // -------------------------------------------------------------
    // 7. LIGHTING & ATMOSPHERE
    // -------------------------------------------------------------
    const ambientLight = new THREE.AmbientLight(0x0a192f, 2.0);
    scene.add(ambientLight);

    const rimLight = new THREE.PointLight(0x7c3aed, 2.5, 10);
    rimLight.position.set(-3, 3, -4);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0x06b6d4, 1.8, 8);
    fillLight.position.set(4, -2, 3);
    scene.add(fillLight);

    // -------------------------------------------------------------
    // 8. INTERACTIVE POINTER PARALLAX & ANIMATION
    // -------------------------------------------------------------
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const onPointerMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 0.7;
      targetMouseY = (e.clientY / window.innerHeight - 0.5) * 0.5;
    };
    window.addEventListener('mousemove', onPointerMove, { passive: true });

    // Handle Resize
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;

      // Adjust camera distance for mobile screens
      if (w < 768) {
        camera.position.z = 8.5;
      } else {
        camera.position.z = 7.2;
      }

      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    onResize();

    // Visibility Handling (Save CPU / GPU when hidden)
    let isTabVisible = true;
    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isTabVisible) return;

      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth pointer lerp
      currentMouseX += (targetMouseX - currentMouseX) * 0.05;
      currentMouseY += (targetMouseY - currentMouseY) * 0.05;

      if (!prefersReducedMotion) {
        // Floating sway
        rootGroup.position.y = Math.sin(elapsed * 0.8) * 0.12;

        // Mouse Parallax
        rootGroup.rotation.y = currentMouseX + elapsed * 0.06;
        rootGroup.rotation.x = -currentMouseY + Math.sin(elapsed * 0.5) * 0.04;

        // Core Document subtle counter-rotation
        docGroup.rotation.y = Math.sin(elapsed * 0.6) * 0.15;

        // Shield breathing pulsation
        const shieldPulse = 1 + Math.sin(elapsed * 1.4) * 0.025;
        shieldGroup.scale.set(shieldPulse, shieldPulse, shieldPulse);
        shieldGroup.rotation.y = -elapsed * 0.1;
        shieldGroup.rotation.z = Math.sin(elapsed * 0.4) * 0.08;

        // Orbiting panels
        orbitPanels.forEach((p) => {
          p.angle += p.speed * delta;
          p.mesh.position.x = Math.cos(p.angle) * p.radius;
          p.mesh.position.z = Math.sin(p.angle) * p.radius;
          p.mesh.position.y = Math.sin(p.angle * 2 + elapsed) * 0.4 + p.inclination * 1.5;
          p.mesh.lookAt(0, p.mesh.position.y * 0.3, 0);
        });

        // Rings Rotation
        ring1.rotation.z += 0.003;
        ring2.rotation.y -= 0.0025;
        ring3.rotation.x += 0.002;

        // Particles rotation & subtle drift
        particles.rotation.y = elapsed * 0.015;
      } else {
        // Static gentle positioning when prefers-reduced-motion is active
        rootGroup.rotation.y = 0.2;
        rootGroup.rotation.x = 0.05;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      // Dispose Three.js memory allocations
      renderer.dispose();
      docGeo.dispose();
      docMat.dispose();
      shieldGeo.dispose();
      shieldMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      ring1Geo.dispose();
      ring2Geo.dispose();
      ring3Geo.dispose();
    };
  }, []);

  return (
    <div className={`relative w-full h-full pointer-events-none select-none overflow-hidden ${className}`}>
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* CSS 3D Fallback if WebGL is disabled or unsupported */}
      {!webGlSupported && (
        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="relative w-64 h-80 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 backdrop-blur-md flex flex-col items-center justify-center p-6 space-y-4 shadow-2xl animate-pulse">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-cyan-400 flex items-center justify-center">
              <div className="w-12 h-16 rounded border border-cyan-300 bg-cyan-500/20" />
            </div>
            <div className="space-y-1.5 text-center">
              <span className="text-xs uppercase tracking-widest text-cyan-400 font-mono">DOCUAGENT AI</span>
              <p className="text-[11px] text-slate-400">Cryptographic Document Shield</p>
            </div>
          </div>
        </div>
      )}

      {/* Atmospheric Radial Gradients & Vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-radial from-transparent via-[#050b18]/40 to-[#030712]/95"
      />
    </div>
  );
};
