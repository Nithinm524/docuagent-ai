/**
 * RippleTransition WebGL Component
 * DOCUAGENT AI
 *
 * Implements the exact WebGL & GLSL shader transition between images
 * with circular expanding ripple wavefront, FBM noise warping, chromatic aberration,
 * luminous crest glow, and pinch distortion.
 *
 * Contains:
 * - vertexSource
 * - fragmentSource
 * - RippleRenderer
 * - fetchPictures
 * - RippleTransitionCanvas
 * - RippleTransition
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { cn } from '@/lib/utils';
import { WebGLErrorBoundary, WebGLFallback } from './webgl-error-boundary';
import { Pause, Play, ChevronRight } from 'lucide-react';

export interface RippleTransitionProps {
  /** Array of image URLs to cycle through */
  images: string[];
  /** Transition duration in seconds (default: 1.4) */
  duration?: number;
  /** Easing function: 'easeInOut' | 'power2.inOut' | 'power1.out' etc. (default: 'easeInOut') */
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

// Full-screen Quad Vertex Shader Source
export const vertexSource = `
attribute vec2 a_pos;
varying vec2 v_uv;

void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Dynamic Ripple Distortion Fragment Shader Source
export const fragmentSource = `
precision highp float;

uniform sampler2D u_texA;
uniform sampler2D u_texB;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_progress;
uniform float u_sigma;
uniform float u_waveFreq;
uniform float u_pushAmt;
uniform float u_caStrength;
uniform float u_glow;
uniform float u_noiseWarp;
uniform float u_swap;
uniform float u_pinch;
uniform int u_reduced_motion;

varying vec2 v_uv;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p, int octaves) {
  float val = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    val += amp * vnoise(p * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return val;
}

void main() {
  vec2 uv = v_uv;

  // Reduced motion: Clean crossfade without ripple wave distortion
  if (u_reduced_motion == 1) {
    vec4 cA = texture2D(u_texA, uv);
    vec4 cB = texture2D(u_texB, uv);
    vec4 baseCol = mix(cA, cB, u_swap);
    vec4 targetCol = mix(cB, cA, u_swap);
    gl_FragColor = mix(baseCol, targetCol, smoothstep(0.0, 1.0, u_progress));
    return;
  }

  vec2 size = u_resolution;
  vec2 center = u_center;
  vec2 p = uv - center;
  float aspect = size.x / max(size.y, 1.0);
  p.x *= aspect;
  float dist = length(p);
  float maxDist = length(vec2(0.5 * aspect, 0.5));
  float normDist = clamp(dist / max(maxDist, 0.001), 0.0, 1.0);

  float noiseLarge = fbm(p * 4.0 + vec2(u_progress * 1.0, u_progress * 0.5), 4);
  float noiseSmall = fbm(p * 12.0 + vec2(u_progress * 2.0, -u_progress * 1.5), 3);
  float coverage = 1.0 + 0.5 * u_noiseWarp + 0.1;
  float waveFront = u_progress * coverage;
  float warpScale = smoothstep(0.0, 0.05, u_progress);
  float warpedDist = normDist
    + (noiseLarge - 0.5) * u_noiseWarp * warpScale
    + (noiseSmall - 0.5) * (u_noiseWarp * 0.9) * warpScale;

  float delta = warpedDist - waveFront;
  float safeSigma = max(u_sigma, 0.01);
  float baseEnvelope = exp(-delta * delta / (2.0 * safeSigma * safeSigma));
  float ripples = max(0.0, cos(delta * u_waveFreq * 6.2831853));
  float envelope = baseEnvelope * ripples;

  float gate = smoothstep(0.0, 0.05, u_progress)
             * (1.0 - smoothstep(0.85, 1.0, u_progress));
  envelope *= gate;

  vec2 dir = (dist > 0.001) ? normalize(p) : vec2(0.0);
  float pushAmt = envelope * u_pushAmt;

  float pinchSigma = 0.10;
  float pinchG = exp(-dist * dist / (2.0 * pinchSigma * pinchSigma));
  float pinchDisp = (dist / (pinchSigma * pinchSigma)) * pinchG * 0.01 * u_pinch;

  vec2 toEdge = min(uv, 1.0 - uv);
  float edgeFade = smoothstep(0.0, 0.14, min(toEdge.x, toEdge.y));
  pinchDisp *= edgeFade;

  vec2 uvOffset = dir * (pushAmt - pinchDisp);
  uvOffset.x /= aspect;

  float caStrength = envelope * u_caStrength;
  vec2 caOffset = dir * caStrength;
  caOffset.x /= aspect;

  vec2 uvR = clamp(uv - uvOffset - caOffset, 0.0, 1.0);
  vec2 uvG = clamp(uv - uvOffset, 0.0, 1.0);
  vec2 uvB = clamp(uv - uvOffset + caOffset, 0.0, 1.0);

  vec4 colorA = vec4(
    texture2D(u_texA, uvR).r,
    texture2D(u_texA, uvG).g,
    texture2D(u_texA, uvB).b,
    1.0
  );
  vec4 colorB = vec4(
    texture2D(u_texB, uvR).r,
    texture2D(u_texB, uvG).g,
    texture2D(u_texB, uvB).b,
    1.0
  );

  float feather = 0.04 + 0.05 * noiseLarge;
  float reveal = smoothstep(waveFront + feather, waveFront - feather, warpedDist);
  reveal *= smoothstep(0.0, 0.05, u_progress);

  vec4 base = mix(colorA, colorB, u_swap);
  vec4 target = mix(colorB, colorA, u_swap);
  vec4 color = mix(base, target, reveal);

  float glow = envelope * u_glow;
  color.rgb = clamp(color.rgb / max(1.0 - glow, 0.01), 0.0, 1.0);
  color.rgb *= 1.0 - 0.16 * pinchG * edgeFade * u_pinch;
  color.rgb = clamp(color.rgb, 0.0, 1.0);

  gl_FragColor = vec4(color.rgb, 1.0);
}
`;

/**
 * Asynchronously preloads images and returns only those successfully loaded
 */
export async function fetchPictures(images: string[]): Promise<HTMLImageElement[]> {
  if (!images || images.length === 0) return [];
  const promises = images.map((src) => {
    return new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.warn(`[RippleTransition] Failed to load picture: ${src}`);
        resolve(null);
      };
      img.src = src;
    });
  });
  const results = await Promise.all(promises);
  return results.filter((img): img is HTMLImageElement => img !== null);
}

/**
 * WebGL Ripple Renderer Engine
 */
export class RippleRenderer {
  public gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private buffer: WebGLBuffer;
  private texA: WebGLTexture;
  private texB: WebGLTexture;
  private uniforms: Record<string, WebGLUniformLocation | null>;

  constructor(canvas: HTMLCanvasElement) {
    const gl = (canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false
    }) || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

    if (!gl) {
      throw new Error('WebGL not supported');
    }
    this.gl = gl;

    // Compile shaders
    const vs = this.compileShader(vertexSource, gl.VERTEX_SHADER);
    const fs = this.compileShader(fragmentSource, gl.FRAGMENT_SHADER);

    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create WebGL program');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program) || 'Program link error';
      gl.deleteProgram(program);
      throw new Error(log);
    }
    this.program = program;
    gl.useProgram(program);

    // Full-screen quad geometry
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error('Failed to create buffer');
    this.buffer = buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // Create 2 textures for ping-pong crossfade
    this.texA = this.createTexture(0);
    this.texB = this.createTexture(1);

    gl.uniform1i(gl.getUniformLocation(program, 'u_texA'), 0);
    gl.uniform1i(gl.getUniformLocation(program, 'u_texB'), 1);

    this.uniforms = {
      res: gl.getUniformLocation(program, 'u_resolution'),
      center: gl.getUniformLocation(program, 'u_center'),
      progress: gl.getUniformLocation(program, 'u_progress'),
      sigma: gl.getUniformLocation(program, 'u_sigma'),
      waveFreq: gl.getUniformLocation(program, 'u_waveFreq'),
      pushAmt: gl.getUniformLocation(program, 'u_pushAmt'),
      caStrength: gl.getUniformLocation(program, 'u_caStrength'),
      glow: gl.getUniformLocation(program, 'u_glow'),
      noiseWarp: gl.getUniformLocation(program, 'u_noiseWarp'),
      swap: gl.getUniformLocation(program, 'u_swap'),
      pinch: gl.getUniformLocation(program, 'u_pinch'),
      reducedMotion: gl.getUniformLocation(program, 'u_reduced_motion')
    };
  }

  private compileShader(source: string, type: number): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Unable to create shader');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader) || 'Shader compilation failed';
      gl.deleteShader(shader);
      throw new Error(info);
    }
    return shader;
  }

  private createTexture(unit: number): WebGLTexture {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error('Unable to create texture');
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

    // Initial 1x1 fallback pixel (deep navy #030712)
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

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  public uploadImage(slot: 'A' | 'B', img: HTMLImageElement) {
    const gl = this.gl;
    const unit = slot === 'A' ? 0 : 1;
    const tex = slot === 'A' ? this.texA : this.texB;

    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  }

  public resize(width: number, height: number) {
    const gl = this.gl;
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);
    gl.uniform2f(this.uniforms.res, width, height);
  }

  public render(params: {
    cx: number;
    cy: number;
    progress: number;
    sigma: number;
    waveFreq: number;
    pushAmt: number;
    caStrength: number;
    glow: number;
    noiseWarp: number;
    swap: number;
    pinch: number;
    reducedMotion?: boolean;
  }) {
    const gl = this.gl;
    gl.useProgram(this.program);

    gl.uniform2f(this.uniforms.center, params.cx, params.cy);
    gl.uniform1f(this.uniforms.progress, params.progress);
    gl.uniform1f(this.uniforms.sigma, params.sigma);
    gl.uniform1f(this.uniforms.waveFreq, params.waveFreq);
    gl.uniform1f(this.uniforms.pushAmt, params.pushAmt);
    gl.uniform1f(this.uniforms.caStrength, params.caStrength);
    gl.uniform1f(this.uniforms.glow, params.glow);
    gl.uniform1f(this.uniforms.noiseWarp, params.noiseWarp);
    gl.uniform1f(this.uniforms.swap, params.swap);
    gl.uniform1f(this.uniforms.pinch, params.pinch);
    gl.uniform1i(this.uniforms.reducedMotion, params.reducedMotion ? 1 : 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  public destroy() {
    const gl = this.gl;
    gl.deleteTexture(this.texA);
    gl.deleteTexture(this.texB);
    gl.deleteBuffer(this.buffer);
    gl.deleteProgram(this.program);
  }
}

/**
 * Canvas Implementation Component
 */
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
  const rendererRef = useRef<RippleRenderer | null>(null);

  // Loaded images & index state
  const picturesRef = useRef<HTMLImageElement[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [nextIdx, setNextIdx] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isAutoPlayActive, setIsAutoPlayActive] = useState(autoPlay);
  const [webglSupported, setWebglSupported] = useState(true);

  // Shader animation state
  const stateRef = useRef({
    progress: 0,
    cx: 0.5,
    cy: 0.5,
    swap: 0,
    pinch: 0
  });

  const isTransitioningRef = useRef(false);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prefersReducedMotionRef = useRef(false);

  // Check reduced-motion preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = media.matches;
    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotionRef.current = e.matches;
    };
    media.addEventListener?.('change', handler);
    return () => media.removeEventListener?.('change', handler);
  }, []);

  // Primary render caller
  const renderCurrentFrame = useCallback(() => {
    if (!rendererRef.current) return;
    const s = stateRef.current;
    rendererRef.current.render({
      cx: s.cx,
      cy: s.cy,
      progress: s.progress,
      sigma,
      waveFreq,
      pushAmt,
      caStrength,
      glow,
      noiseWarp,
      swap: s.swap,
      pinch: s.pinch,
      reducedMotion: prefersReducedMotionRef.current
    });
  }, [sigma, waveFreq, pushAmt, caStrength, glow, noiseWarp]);

  // Trigger transition between images
  const triggerTransition = useCallback(
    (targetIndex?: number, origin?: [number, number]) => {
      if (isTransitioningRef.current || picturesRef.current.length < 2) return;
      const pictures = picturesRef.current;
      const renderer = rendererRef.current;
      if (!renderer) return;

      const fromIndex = currentIdx;
      const toIndex =
        targetIndex !== undefined
          ? (targetIndex + pictures.length) % pictures.length
          : (currentIdx + 1) % pictures.length;

      if (fromIndex === toIndex) return;

      isTransitioningRef.current = true;
      setIsTransitioning(true);
      setNextIdx(toIndex);

      if (onTransitionStart) {
        onTransitionStart(fromIndex, toIndex);
      }

      // Origin coordinates
      if (origin) {
        stateRef.current.cx = origin[0];
        stateRef.current.cy = origin[1];
      } else if (autoPlayOrigin === 'center') {
        stateRef.current.cx = 0.5;
        stateRef.current.cy = 0.5;
      } else if (autoPlayOrigin === 'random') {
        stateRef.current.cx = 0.2 + Math.random() * 0.6;
        stateRef.current.cy = 0.2 + Math.random() * 0.6;
      } else if (Array.isArray(autoPlayOrigin)) {
        stateRef.current.cx = autoPlayOrigin[0];
        stateRef.current.cy = autoPlayOrigin[1];
      }

      // Upload target image into destination slot (ping-pong)
      const currentSlot = stateRef.current.swap < 0.5 ? 'A' : 'B';
      const targetSlot = currentSlot === 'A' ? 'B' : 'A';
      renderer.uploadImage(targetSlot, pictures[toIndex]);

      gsap.killTweensOf(stateRef.current);
      stateRef.current.progress = 0;
      stateRef.current.pinch = 0;

      if (pinch) {
        gsap.to(stateRef.current, {
          keyframes: [
            { pinch: 0.3, duration: 0.1, ease: 'power3.out' },
            { pinch: 0, duration: 0.4, ease: 'power2.in' }
          ],
          onUpdate: renderCurrentFrame
        });
      }

      // Map ease string to GSAP format
      let gsapEase = 'power2.inOut';
      if (ease === 'easeInOut') gsapEase = 'power2.inOut';
      else if (ease === 'easeOut') gsapEase = 'power2.out';
      else if (ease === 'linear') gsapEase = 'none';
      else if (ease) gsapEase = ease;

      gsap.to(stateRef.current, {
        progress: 1,
        duration: Math.max(0.4, duration),
        ease: gsapEase,
        onUpdate: renderCurrentFrame,
        onComplete: () => {
          // Swap textures
          stateRef.current.swap = stateRef.current.swap > 0.5 ? 0 : 1;
          stateRef.current.progress = 0;
          isTransitioningRef.current = false;
          setIsTransitioning(false);
          setCurrentIdx(toIndex);
          renderCurrentFrame();

          if (onTransitionEnd) {
            onTransitionEnd(toIndex);
          }
        }
      });
    },
    [currentIdx, autoPlayOrigin, pinch, ease, duration, onTransitionStart, onTransitionEnd, renderCurrentFrame]
  );

  // Setup WebGL Renderer and load images
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let cancelled = false;

    const init = async () => {
      try {
        const renderer = new RippleRenderer(canvas);
        rendererRef.current = renderer;

        // Preload pictures
        const loadedPics = await fetchPictures(images);
        if (cancelled) {
          renderer.destroy();
          return;
        }

        if (loadedPics.length === 0) {
          console.warn('[RippleTransition] No pictures loaded successfully');
          setWebglSupported(false);
          return;
        }

        picturesRef.current = loadedPics;

        // Initialize Slot A with initial picture, and Slot B with second picture if available
        renderer.uploadImage('A', loadedPics[0]);
        if (loadedPics.length > 1) {
          renderer.uploadImage('B', loadedPics[1]);
        }

        // Handle Resize with DPR
        const handleResize = () => {
          if (!container || !canvas || cancelled) return;
          const rect = container.getBoundingClientRect();
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const width = Math.max(1, Math.round(rect.width * dpr));
          const height = Math.max(1, Math.round(rect.height * dpr));

          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            renderer.resize(width, height);
            renderCurrentFrame();
          }
        };

        const observer = new ResizeObserver(handleResize);
        observer.observe(container);
        handleResize();

        // Render initial frame immediately
        renderCurrentFrame();
      } catch (err) {
        console.warn('[RippleTransition] WebGL initialization failed, fallback active:', err);
        setWebglSupported(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      gsap.killTweensOf(stateRef.current);
      if (rendererRef.current) {
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, [images, renderCurrentFrame]);

  // Autoplay timer handling
  useEffect(() => {
    if (!isAutoPlayActive || images.length < 2 || isTransitioning) {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      return;
    }

    const startTimer = () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      if (document.hidden || prefersReducedMotionRef.current) return;
      autoPlayTimerRef.current = setInterval(() => {
        triggerTransition();
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
  }, [isAutoPlayActive, images.length, isTransitioning, autoPlayInterval, triggerTransition]);

  // Interactive pointer click trigger
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || isTransitioningRef.current || picturesRef.current.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const cy = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    triggerTransition(undefined, [cx, cy]);
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
      title={interactive ? 'Click to trigger ripple transition' : label}
    >
      {/* Primary WebGL Ripple Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block object-cover"
        style={{ borderRadius: `${borderRadius}px` }}
      />

      {/* Custom or Default Overlays */}
      {renderOverlay ? (
        renderOverlay(currentIdx, isTransitioning)
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
                aria-label={`Jump to scene ${idx + 1}`}
                className={`h-1.5 transition-all rounded-full cursor-pointer ${
                  currentIdx === idx
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
                triggerTransition();
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

export default RippleTransition;
