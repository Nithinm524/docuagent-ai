/**
 * Complete RippleTransition WebGL Component
 * DOCUAGENT AI
 *
 * Implements a high-performance WebGL & GLSL shader transition between images
 * with circular expanding ripple waves, Gaussian dispersion, chromatic aberration,
 * restrained glow, noise warp, and Framer Motion integration.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { WebGLErrorBoundary, WebGLFallback } from './webgl-error-boundary';
import { Pause, Play, ChevronRight } from 'lucide-react';

export interface RippleTransitionProps {
  /** Array of image URLs to cycle through */
  images: string[];
  /** Transition duration in seconds (default: 1.4) */
  duration?: number;
  /** Easing function or string: 'easeInOut' | 'easeOut' | 'linear' (default: 'easeInOut') */
  ease?: string;
  /** Whether transitions should advance automatically (default: true) */
  autoPlay?: boolean;
  /** Milliseconds between automatic transitions (default: 5000) */
  autoPlayInterval?: number;
  /** Origin of automatic transitions: 'center' | 'random' | 'mouse' | [number, number] (default: 'center') */
  autoPlayOrigin?: 'center' | 'random' | 'mouse' | [number, number];
  /** Wave propagation speed (default: 1.6) */
  waveSpeed?: number;
  /** Gaussian wave packet envelope width / dispersion standard deviation (default: 0.15) */
  sigma?: number;
  /** Wave frequency oscillation factor (default: 5) */
  waveFreq?: number;
  /** Wave displacement amplitude / push amount (default: 0.145) */
  pushAmt?: number;
  /** Chromatic aberration color separation strength (default: 0.02) */
  caStrength?: number;
  /** Luminous ripple crest glow intensity (default: 0.73) */
  glow?: number;
  /** Noise warp perturbation intensity (default: 1) */
  noiseWarp?: number;
  /** Radial pinch distortion toggle (default: false) */
  pinch?: boolean;
  /** Border radius in pixels (default: 0) */
  borderRadius?: number;
  /** Background hex color (default: '#030712') */
  background?: string;
  /** Accessibility label / title */
  label?: string;
  /** Allow clicking the canvas to trigger ripple from pointer location (default: true) */
  interactive?: boolean;
  /** Whether to show bottom transition indicators and controls (default: false) */
  showControls?: boolean;
  /** Optional container class name */
  className?: string;
  /** Optional inline styles */
  style?: React.CSSProperties;
  /** Callback fired when transition initiates */
  onTransitionStart?: (fromIndex: number, toIndex: number) => void;
  /** Callback fired when transition completes */
  onTransitionEnd?: (currentIndex: number) => void;
  /** Optional overlay caption or badge renderer */
  renderOverlay?: (currentIndex: number, isTransitioning: boolean) => React.ReactNode;
}

// Full-screen Quad Vertex Shader
const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_uv;
varying vec2 v_uv;

void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

// Dynamic Ripple Wave Distortion Fragment Shader
const FRAGMENT_SHADER_SOURCE = `
precision highp float;

varying vec2 v_uv;

uniform sampler2D u_tex_current;
uniform sampler2D u_tex_next;
uniform float u_progress;
uniform vec2 u_resolution;
uniform vec2 u_origin;
uniform float u_wave_speed;
uniform float u_sigma;
uniform float u_wave_freq;
uniform float u_push_amt;
uniform float u_ca_strength;
uniform float u_glow;
uniform float u_noise_warp;
uniform int u_pinch;
uniform int u_reduced_motion;

// 2D Hash function for noise warp
float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = v_uv;

  // Reduced motion: Clean non-distorted crossfade
  if (u_reduced_motion == 1) {
    vec4 c1 = texture2D(u_tex_current, uv);
    vec4 c2 = texture2D(u_tex_next, uv);
    gl_FragColor = mix(c1, c2, smoothstep(0.0, 1.0, u_progress));
    return;
  }

  // Correct for aspect ratio in radial distance calculation
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 aspect_origin = vec2(u_origin.x * aspect, u_origin.y);
  vec2 aspect_uv = vec2(uv.x * aspect, uv.y);

  vec2 delta = aspect_uv - aspect_origin;
  float dist = length(delta);
  vec2 dir = dist > 0.0001 ? normalize(delta) : vec2(0.0, 1.0);

  // Noise perturbation warp along radial direction
  float noise = (hash21(floor(aspect_uv * 32.0)) - 0.5) * 0.02 * u_noise_warp;
  float warped_dist = dist + noise;

  // Optional pinch distortion
  if (u_pinch == 1) {
    float pinch_factor = sin(u_progress * 3.14159265) * 0.08;
    uv += dir * pinch_factor * exp(-dist * 4.0);
  }

  // Progressive wave front propagating outwards
  float wave_radius = u_progress * (u_wave_speed > 0.0 ? u_wave_speed : 1.6);
  float wave_dist = warped_dist - wave_radius;

  // Gaussian wave packet envelope: exp(-(d / sigma)^2)
  float safe_sigma = max(u_sigma, 0.02);
  float envelope = exp(-pow(wave_dist / safe_sigma, 2.0));
  float wave = sin(wave_dist * u_wave_freq * 6.2831853) * envelope * u_push_amt * (1.0 - u_progress);

  // Displaced UVs
  vec2 uv_curr = uv + dir * wave;
  vec2 uv_next = uv - dir * wave * (1.0 - u_progress);

  // Chromatic aberration (RGB shift along wave vector)
  vec2 red_offset = dir * wave * u_ca_strength;
  vec2 blue_offset = -dir * wave * u_ca_strength;

  float r1 = texture2D(u_tex_current, uv_curr + red_offset).r;
  float g1 = texture2D(u_tex_current, uv_curr).g;
  float b1 = texture2D(u_tex_current, uv_curr + blue_offset).b;
  float a1 = texture2D(u_tex_current, uv_curr).a;
  vec4 color_curr = vec4(r1, g1, b1, a1);

  float r2 = texture2D(u_tex_next, uv_next + red_offset).r;
  float g2 = texture2D(u_tex_next, uv_next).g;
  float b2 = texture2D(u_tex_next, uv_next + blue_offset).b;
  float a2 = texture2D(u_tex_next, uv_next).a;
  vec4 color_next = vec4(r2, g2, b2, a2);

  // Blend based on progress and wave front boundary
  float blend_threshold = smoothstep(0.0, 1.0, u_progress);
  float blend = smoothstep(wave_radius - safe_sigma * 1.5, wave_radius + safe_sigma * 1.5, warped_dist);
  vec4 final_color = mix(color_next, color_curr, blend);
  final_color = mix(final_color, color_next, blend_threshold);

  // Luminous crest highlight glow along the wave ridge
  float crest_glow = envelope * u_glow * sin(u_progress * 3.14159265);
  final_color.rgb += vec3(0.05, 0.50, 0.75) * crest_glow;

  gl_FragColor = final_color;
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[RippleTransition] Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[RippleTransition] Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export const RippleTransitionCanvas: React.FC<RippleTransitionProps> = ({
  images,
  duration = 1.4,
  ease = 'easeInOut',
  autoPlay = true,
  autoPlayInterval = 5000,
  autoPlayOrigin = 'center',
  waveSpeed = 1.6,
  sigma = 0.15,
  waveFreq = 5,
  pushAmt = 0.145,
  caStrength = 0.02,
  glow = 0.73,
  noiseWarp = 1,
  pinch = false,
  borderRadius = 0,
  background = '#030712',
  label = 'DOCUAGENT AI animated login background',
  interactive = true,
  showControls = false,
  className = '',
  style,
  onTransitionStart,
  onTransitionEnd,
  renderOverlay
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // WebGL context and resource references
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const texturesRef = useRef<WebGLTexture[]>([]);
  const vertexBufferRef = useRef<WebGLBuffer | null>(null);

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isAutoPlayActive, setIsAutoPlayActive] = useState(autoPlay);
  const [loadedImagesCount, setLoadedImagesCount] = useState(0);
  const [webglSupported, setWebglSupported] = useState(true);

  // Concurrency and animation refs
  const isTransitioningRef = useRef(false);
  const animFrameIdRef = useRef<number | null>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transitionStartTimeRef = useRef<number>(0);
  const rippleOriginRef = useRef<[number, number]>([0.5, 0.5]);
  const prefersReducedMotionRef = useRef(false);

  // Detect reduced-motion preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = mediaQuery.matches;

    const listener = (e: MediaQueryListEvent) => {
      prefersReducedMotionRef.current = e.matches;
    };
    mediaQuery.addEventListener?.('change', listener);
    return () => mediaQuery.removeEventListener?.('change', listener);
  }, []);

  // Preload and upload image textures to WebGL
  const loadTextures = useCallback(
    (gl: WebGLRenderingContext) => {
      if (!images || images.length === 0) return;

      const loadedTextures: WebGLTexture[] = [];
      let successCount = 0;

      images.forEach((src, idx) => {
        const texture = gl.createTexture();
        if (!texture) return;
        gl.bindTexture(gl.TEXTURE_2D, texture);

        // Placeholder 1x1 dark pixel while image loads
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          1,
          1,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          new Uint8Array([3, 7, 18, 255])
        );

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        loadedTextures[idx] = texture;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (!glRef.current) return;
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
          successCount++;
          setLoadedImagesCount(successCount);
          renderFrame(0);
        };
        img.onerror = () => {
          console.warn(`[RippleTransition] Could not load image at index ${idx}: ${src}`);
        };
        img.src = src;
      });

      texturesRef.current = loadedTextures;
    },
    [images]
  );

  // Initialize WebGL context, shaders, and geometry
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (canvas.getContext('webgl', {
      antialias: true,
      alpha: true,
      premultipliedAlpha: false
    }) || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

    if (!gl) {
      console.warn('[RippleTransition] WebGL not supported, falling back to static visual.');
      setWebglSupported(false);
      return;
    }

    glRef.current = gl;

    // Compile shaders
    const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vs || !fs) {
      setWebglSupported(false);
      return;
    }

    const program = createProgram(gl, vs, fs);
    if (!program) {
      setWebglSupported(false);
      return;
    }
    programRef.current = program;

    // Full-screen quad coordinates: positions (vec2) and UVs (vec2)
    const vertices = new Float32Array([
      -1.0, -1.0, 0.0, 1.0,
       1.0, -1.0, 1.0, 1.0,
      -1.0,  1.0, 0.0, 0.0,
       1.0,  1.0, 1.0, 0.0
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    vertexBufferRef.current = buffer;

    // Load textures
    loadTextures(gl);

    // Resize handling via ResizeObserver
    const handleResize = () => {
      if (!canvas || !containerRef.current || !gl) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
        renderFrame(0);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    handleResize();

    // Context loss & restoration
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
    const handleContextRestored = () => {
      if (gl) loadTextures(gl);
    };
    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);

      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      if (gl) {
        texturesRef.current.forEach((t) => gl.deleteTexture(t));
        texturesRef.current = [];
        if (vertexBufferRef.current) gl.deleteBuffer(vertexBufferRef.current);
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
        if (program) gl.deleteProgram(program);
      }
      glRef.current = null;
    };
  }, [loadTextures]);

  // Render a single WebGL frame at a given progress (0..1)
  const renderFrame = useCallback(
    (progress: number, fromIdx = currentIndex, toIdx = nextIndex) => {
      const gl = glRef.current;
      const program = programRef.current;
      const buffer = vertexBufferRef.current;
      const textures = texturesRef.current;
      if (!gl || !program || !buffer || textures.length === 0) return;

      const tex1 = textures[fromIdx % textures.length];
      const tex2 = textures[toIdx % textures.length];
      if (!tex1 || !tex2) return;

      gl.useProgram(program);

      // Vertex attributes
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      const posLoc = gl.getAttribLocation(program, 'a_position');
      const uvLoc = gl.getAttribLocation(program, 'a_uv');

      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);

      gl.enableVertexAttribArray(uvLoc);
      gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

      // Bind texture units
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex1);
      gl.uniform1i(gl.getUniformLocation(program, 'u_tex_current'), 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, tex2);
      gl.uniform1i(gl.getUniformLocation(program, 'u_tex_next'), 1);

      // Set uniforms
      gl.uniform1f(gl.getUniformLocation(program, 'u_progress'), progress);
      gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), gl.canvas.width, gl.canvas.height);
      gl.uniform2f(
        gl.getUniformLocation(program, 'u_origin'),
        rippleOriginRef.current[0],
        rippleOriginRef.current[1]
      );
      gl.uniform1f(gl.getUniformLocation(program, 'u_wave_speed'), waveSpeed);
      gl.uniform1f(gl.getUniformLocation(program, 'u_sigma'), sigma);
      gl.uniform1f(gl.getUniformLocation(program, 'u_wave_freq'), waveFreq);
      gl.uniform1f(gl.getUniformLocation(program, 'u_push_amt'), pushAmt);
      gl.uniform1f(gl.getUniformLocation(program, 'u_ca_strength'), caStrength);
      gl.uniform1f(gl.getUniformLocation(program, 'u_glow'), glow);
      gl.uniform1f(gl.getUniformLocation(program, 'u_noise_warp'), noiseWarp);
      gl.uniform1i(gl.getUniformLocation(program, 'u_pinch'), pinch ? 1 : 0);
      gl.uniform1i(
        gl.getUniformLocation(program, 'u_reduced_motion'),
        prefersReducedMotionRef.current ? 1 : 0
      );

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    [
      currentIndex,
      nextIndex,
      waveSpeed,
      sigma,
      waveFreq,
      pushAmt,
      caStrength,
      glow,
      noiseWarp,
      pinch
    ]
  );

  // Trigger transition to a target index from a specific origin
  const triggerTransition = useCallback(
    (targetIdx: number, origin: [number, number] = [0.5, 0.5]) => {
      if (isTransitioningRef.current || images.length < 2) return;

      const fromIdx = currentIndex;
      const toIdx = (targetIdx + images.length) % images.length;
      if (fromIdx === toIdx) return;

      isTransitioningRef.current = true;
      setIsTransitioning(true);
      setNextIndex(toIdx);
      rippleOriginRef.current = origin;

      if (onTransitionStart) {
        onTransitionStart(fromIdx, toIdx);
      }

      transitionStartTimeRef.current = performance.now();
      const durMs = Math.max(0.4, duration) * 1000;

      const animate = (now: number) => {
        const elapsed = now - transitionStartTimeRef.current;
        const progress = Math.min(1.0, elapsed / durMs);

        // Easing interpolation
        let easedProgress = progress;
        if (ease === 'easeInOut') {
          easedProgress =
            progress < 0.5
              ? 4 * progress * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        } else if (ease === 'easeOut') {
          easedProgress = 1 - Math.pow(1 - progress, 3);
        }

        renderFrame(easedProgress, fromIdx, toIdx);

        if (progress < 1.0) {
          animFrameIdRef.current = requestAnimationFrame(animate);
        } else {
          // Transition complete
          setCurrentIndex(toIdx);
          setNextIndex(toIdx);
          isTransitioningRef.current = false;
          setIsTransitioning(false);
          renderFrame(0, toIdx, toIdx);

          if (onTransitionEnd) {
            onTransitionEnd(toIdx);
          }
        }
      };

      animFrameIdRef.current = requestAnimationFrame(animate);
    },
    [currentIndex, images.length, duration, ease, onTransitionStart, onTransitionEnd, renderFrame]
  );

  // Advance to next image
  const advance = useCallback(() => {
    let origin: [number, number] = [0.5, 0.5];
    if (autoPlayOrigin === 'center') {
      origin = [0.5, 0.5];
    } else if (autoPlayOrigin === 'random') {
      origin = [0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6];
    } else if (Array.isArray(autoPlayOrigin)) {
      origin = autoPlayOrigin;
    }
    triggerTransition(currentIndex + 1, origin);
  }, [currentIndex, autoPlayOrigin, triggerTransition]);

  // Handle autoplay interval and pause when page is hidden or reduced motion is active
  useEffect(() => {
    if (!isAutoPlayActive || images.length < 2 || isTransitioning) {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      return;
    }

    const startTimer = () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      if (document.hidden || prefersReducedMotionRef.current) return;
      autoPlayTimerRef.current = setInterval(() => {
        advance();
      }, Math.max(2500, autoPlayInterval));
    };

    startTimer();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (autoPlayTimerRef.current) {
          clearInterval(autoPlayTimerRef.current);
          autoPlayTimerRef.current = null;
        }
      } else {
        startTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAutoPlayActive, images.length, isTransitioning, autoPlayInterval, advance]);

  // Interactive pointer click trigger
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || isTransitioningRef.current || images.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    triggerTransition(currentIndex + 1, [x, y]);
  };

  if (!webglSupported) {
    return <WebGLFallback className={className} />;
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      className={cn(
        'relative overflow-hidden select-none',
        interactive && 'cursor-pointer',
        className
      )}
      style={{
        borderRadius: `${borderRadius}px`,
        backgroundColor: background,
        ...style
      }}
      aria-label={label}
      title={interactive ? 'Click to trigger holographic ripple wave' : label}
    >
      {/* Primary WebGL Ripple Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block object-cover"
        style={{ borderRadius: `${borderRadius}px` }}
      />

      {/* Subtle Cyan Radial Vignette */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/30"
        style={{ borderRadius: `${borderRadius}px` }}
      />

      {/* Custom or Default Overlays */}
      {renderOverlay ? (
        renderOverlay(currentIndex, isTransitioning)
      ) : showControls ? (
        <div className="absolute inset-x-0 bottom-0 p-5 flex items-center justify-between pointer-events-none">
          {/* Specimen Index Indicators */}
          <div className="flex items-center space-x-1.5 pointer-events-auto">
            {images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerTransition(idx, [0.5, 0.5]);
                }}
                disabled={isTransitioning}
                aria-label={`Jump to specimen ${idx + 1}`}
                className={`h-1.5 transition-all rounded-full cursor-pointer ${
                  currentIndex === idx
                    ? 'w-6 bg-cyan-400 shadow-sm shadow-cyan-400/50'
                    : 'w-1.5 bg-slate-600/70 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>

          {/* Autoplay & Advance Controls */}
          <div className="flex items-center space-x-2 pointer-events-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsAutoPlayActive(!isAutoPlayActive);
              }}
              className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 backdrop-blur-md transition-colors cursor-pointer text-[10px]"
              title={isAutoPlayActive ? 'Pause auto transition' : 'Start auto transition'}
              aria-label={isAutoPlayActive ? 'Pause autoplay' : 'Play autoplay'}
            >
              {isAutoPlayActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                advance();
              }}
              disabled={isTransitioning}
              className="p-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 hover:text-white border border-cyan-700/60 backdrop-blur-md transition-colors cursor-pointer disabled:opacity-50 text-[10px]"
              title="Next ripple transition"
              aria-label="Next transition"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const RippleTransition: React.FC<RippleTransitionProps> = (props) => {
  return (
    <WebGLErrorBoundary fallback={<WebGLFallback className={props.className} />}>
      <RippleTransitionCanvas {...props} />
    </WebGLErrorBoundary>
  );
};
