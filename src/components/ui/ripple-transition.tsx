/**
 * DOCUAGENT AI — WebGL RippleTransition
 * Full-screen image transitions using a circular expanding wave.
 * Replace ONLY src/components/ui/ripple-transition.tsx with this file.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WebGLErrorBoundary, WebGLFallback } from './webgl-error-boundary';

export interface RippleTransitionProps {
  images: string[];
  duration?: number;
  ease?: 'easeInOut' | 'easeOut' | 'linear' | string;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  autoPlayOrigin?: 'center' | 'random' | 'mouse' | [number, number];
  waveSpeed?: number;
  sigma?: number;
  waveFreq?: number;
  pushAmt?: number;
  caStrength?: number;
  glow?: number;
  noiseWarp?: number;
  pinch?: boolean;
  borderRadius?: number;
  background?: string;
  label?: string;
  interactive?: boolean;
  showControls?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onTransitionStart?: (fromIndex: number, toIndex: number) => void;
  onTransitionEnd?: (currentIndex: number) => void;
  renderOverlay?: (currentIndex: number, isTransitioning: boolean) => React.ReactNode;
}

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_uv;
varying vec2 v_uv;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

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
uniform vec2 u_cursor_origins[4];
uniform float u_cursor_start_times[4];
uniform float u_cursor_active[4];
uniform float u_time;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 aspect_uv = vec2(uv.x * aspect, uv.y);
  vec2 aspect_origin = vec2(u_origin.x * aspect, u_origin.y);
  vec2 delta = aspect_uv - aspect_origin;
  float dist = length(delta);
  vec2 dir = dist > 0.0001 ? normalize(delta) : vec2(0.0, 1.0);

  // Cursor-triggered rings are independent of image transitions. Their start
  // times are retained, so a new mouse movement never resets an expanding wave.
  vec2 cursor_warp = vec2(0.0);
  float cursor_glow = 0.0;
  for (int i = 0; i < 4; i++) {
    if (u_cursor_active[i] > 0.5) {
      float age = max(0.0, u_time - u_cursor_start_times[i]);
      float cursor_radius = age * 0.95;
      vec2 cursor_origin_aspect = vec2(u_cursor_origins[i].x * aspect, u_cursor_origins[i].y);
      vec2 cursor_delta = aspect_uv - cursor_origin_aspect;
      float cursor_distance = length(cursor_delta);
      vec2 cursor_direction = cursor_distance > 0.0001
        ? normalize(cursor_delta)
        : vec2(0.0, 1.0);
      float ring_distance = cursor_distance - cursor_radius;
      float ring_envelope = exp(-pow(ring_distance / 0.035, 2.0));
      float ring_wave = sin(ring_distance * 95.0) * ring_envelope * exp(-age * 1.1);
      cursor_warp += cursor_direction * ring_wave * 0.018;
      cursor_glow += ring_envelope * exp(-age * 1.1);
    }
  }
  uv += cursor_warp;

  float noise = (hash21(floor(aspect_uv * 32.0)) - 0.5) * 0.02 * u_noise_warp;
  float warped_dist = dist + noise;
  float progress = clamp(u_progress, 0.0, 1.0);

  if (u_pinch == 1) {
    float pinch_factor = sin(progress * 3.14159265) * 0.08;
    uv += dir * pinch_factor * exp(-dist * 4.0);
  }

  // The radius grows beyond the furthest corner on a wide screen.
  float farthest = length(vec2(aspect * 0.5, 0.5));
  float wave_radius = progress * max(farthest + 0.12, u_wave_speed);
  float wave_dist = warped_dist - wave_radius;
  float safe_sigma = max(u_sigma, 0.025);
  float envelope = exp(-pow(wave_dist / safe_sigma, 2.0));
  float wave = sin(wave_dist * u_wave_freq * 6.2831853)
             * envelope * u_push_amt * (1.0 - progress);

  vec2 uv_current = uv + dir * wave;
  vec2 uv_next = uv - dir * wave * (1.0 - progress);
  vec2 red_offset = dir * wave * u_ca_strength;
  vec2 blue_offset = -dir * wave * u_ca_strength;

  vec4 current_color = vec4(
    texture2D(u_tex_current, uv_current + red_offset).r,
    texture2D(u_tex_current, uv_current).g,
    texture2D(u_tex_current, uv_current + blue_offset).b,
    texture2D(u_tex_current, uv_current).a
  );
  vec4 next_color = vec4(
    texture2D(u_tex_next, uv_next + red_offset).r,
    texture2D(u_tex_next, uv_next).g,
    texture2D(u_tex_next, uv_next + blue_offset).b,
    texture2D(u_tex_next, uv_next).a
  );

  // Outside the wave is the old image; inside the wave is the incoming image.
  // There is deliberately no second full-screen crossfade here.
  float edge = safe_sigma * 1.5;
  float old_image_mask = 1.0 - smoothstep(wave_radius - edge, wave_radius + edge, warped_dist);
  vec4 final_color = mix(next_color, current_color, 1.0 - old_image_mask);

  float crest_glow = envelope * u_glow * sin(progress * 3.14159265);
  final_color.rgb += vec3(0.05, 0.50, 0.75) * crest_glow;
  final_color.rgb += vec3(0.04, 0.55, 0.85) * cursor_glow * 0.18;
  gl_FragColor = final_color;
}
`;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[RippleTransition] Shader compilation failed:', gl.getShaderInfoLog(shader));
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
    console.error('[RippleTransition] Program linking failed:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

interface WebGLResources {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  positionLocation: number;
  uvLocation: number;
}

export const RippleTransitionCanvas: React.FC<RippleTransitionProps> = (props) => {
  const {
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
  } = props;

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resourcesRef = useRef<WebGLResources | null>(null);
  const texturesRef = useRef<WebGLTexture[]>([]);
  const imageElementsRef = useRef<HTMLImageElement[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const autoplayTimerRef = useRef<number | null>(null);
  const transitioningRef = useRef(false);
  const currentIndexRef = useRef(0);
  const lastPointerOriginRef = useRef<[number, number]>([0.5, 0.5]);
  const hoverAnimationFrameRef = useRef<number | null>(null);
  const lastHoverRippleAtRef = useRef(0);
  const cursorRippleEventsRef = useRef([
    { origin: [0.5, 0.5] as [number, number], startedAt: -100, active: false },
    { origin: [0.5, 0.5] as [number, number], startedAt: -100, active: false },
    { origin: [0.5, 0.5] as [number, number], startedAt: -100, active: false },
    { origin: [0.5, 0.5] as [number, number], startedAt: -100, active: false }
  ]);
  const nextCursorRippleSlotRef = useRef(0);
  const propsRef = useRef(props);
  const imagesReadyRef = useRef(false);
  const imagesRef = useRef(images);
  propsRef.current = props;
  imagesRef.current = images;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isAutoPlayActive, setIsAutoPlayActive] = useState(autoPlay);
  const [imagesReady, setImagesReady] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);

  const renderFrame = useCallback((
    progress: number,
    fromIndex: number,
    toIndex: number,
    origin: [number, number]
  ) => {
    const resources = resourcesRef.current;
    const textures = texturesRef.current;
    if (!resources || textures.length === 0) return;

    const { gl, program, buffer, positionLocation, uvLocation } = resources;
    const currentTexture = textures[fromIndex];
    const nextTexture = textures[toIndex];
    if (!currentTexture || !nextTexture) return;

    const latest = propsRef.current;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLocation);
    gl.vertexAttribPointer(uvLocation, 2, gl.FLOAT, false, 16, 8);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, currentTexture);
    gl.uniform1i(gl.getUniformLocation(program, 'u_tex_current'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, nextTexture);
    gl.uniform1i(gl.getUniformLocation(program, 'u_tex_next'), 1);

    gl.uniform1f(gl.getUniformLocation(program, 'u_progress'), progress);
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), gl.canvas.width, gl.canvas.height);
    gl.uniform2f(gl.getUniformLocation(program, 'u_origin'), origin[0], origin[1]);
    gl.uniform1f(gl.getUniformLocation(program, 'u_wave_speed'), latest.waveSpeed ?? 1.6);
    gl.uniform1f(gl.getUniformLocation(program, 'u_sigma'), latest.sigma ?? 0.15);
    gl.uniform1f(gl.getUniformLocation(program, 'u_wave_freq'), latest.waveFreq ?? 5);
    gl.uniform1f(gl.getUniformLocation(program, 'u_push_amt'), latest.pushAmt ?? 0.145);
    gl.uniform1f(gl.getUniformLocation(program, 'u_ca_strength'), latest.caStrength ?? 0.02);
    gl.uniform1f(gl.getUniformLocation(program, 'u_glow'), latest.glow ?? 0.73);
    gl.uniform1f(gl.getUniformLocation(program, 'u_noise_warp'), latest.noiseWarp ?? 1);
    gl.uniform1i(gl.getUniformLocation(program, 'u_pinch'), latest.pinch ? 1 : 0);

    const cursorOrigins = new Float32Array(8);
    const cursorStartTimes = new Float32Array(4);
    const cursorActive = new Float32Array(4);
    const nowSeconds = performance.now() / 1000;
    cursorRippleEventsRef.current.forEach((ripple, index) => {
      cursorOrigins[index * 2] = ripple.origin[0];
      cursorOrigins[index * 2 + 1] = ripple.origin[1];
      cursorStartTimes[index] = ripple.startedAt;
      cursorActive[index] = ripple.active && nowSeconds - ripple.startedAt < 1.8 ? 1 : 0;
      if (nowSeconds - ripple.startedAt >= 1.8) ripple.active = false;
    });
    gl.uniform2fv(gl.getUniformLocation(program, 'u_cursor_origins[0]'), cursorOrigins);
    gl.uniform1fv(gl.getUniformLocation(program, 'u_cursor_start_times[0]'), cursorStartTimes);
    gl.uniform1fv(gl.getUniformLocation(program, 'u_cursor_active[0]'), cursorActive);
    gl.uniform1f(gl.getUniformLocation(program, 'u_time'), nowSeconds);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, []);

  const transitionTo = useCallback((targetIndex: number, origin: [number, number] = [0.5, 0.5]) => {
    const imageCount = imagesRef.current.length;
    if (!imagesReadyRef.current || imageCount < 2 || transitioningRef.current || !resourcesRef.current) return;

    const fromIndex = currentIndexRef.current;
    const toIndex = ((targetIndex % imageCount) + imageCount) % imageCount;
    if (toIndex === fromIndex) return;

    if (hoverAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(hoverAnimationFrameRef.current);
      hoverAnimationFrameRef.current = null;
    }
    transitioningRef.current = true;
    setIsTransitioning(true);
    propsRef.current.onTransitionStart?.(fromIndex, toIndex);
    const startedAt = performance.now();
    const durationMs = Math.max(0.4, propsRef.current.duration ?? 1.4) * 1000;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const activeEase = propsRef.current.ease ?? 'easeInOut';
      let eased = progress;
      if (activeEase === 'easeInOut') {
        eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      } else if (activeEase === 'easeOut') {
        eased = 1 - Math.pow(1 - progress, 3);
      }

      renderFrame(eased, fromIndex, toIndex, origin);
      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      currentIndexRef.current = toIndex;
      setCurrentIndex(toIndex);
      transitioningRef.current = false;
      setIsTransitioning(false);
      renderFrame(0, toIndex, toIndex, origin);
      propsRef.current.onTransitionEnd?.(toIndex);
    };

    if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = window.requestAnimationFrame(tick);
  }, [renderFrame]);

  const advance = useCallback(() => {
    const setting = propsRef.current.autoPlayOrigin ?? 'center';
    let origin: [number, number] = [0.5, 0.5];
    if (setting === 'random') {
      origin = [0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6];
    } else if (setting === 'mouse') {
      origin = lastPointerOriginRef.current;
    } else if (Array.isArray(setting)) {
      origin = [Number(setting[0]), Number(setting[1])];
    }
    transitionTo(currentIndexRef.current + 1, origin);
  }, [transitionTo]);

  // Register a cursor ripple without resetting the previous wave. The shader
  // animates every retained ring independently, so waves continue expanding while
  // the user keeps moving the pointer.
  const triggerHoverRipple = useCallback((origin: [number, number]) => {
    if (
      !interactive ||
      !imagesReadyRef.current ||
      transitioningRef.current ||
      !resourcesRef.current ||
      imagesRef.current.length < 1
    ) return;

    const now = performance.now();
    if (now - lastHoverRippleAtRef.current < 75) return;
    lastHoverRippleAtRef.current = now;

    const slot = nextCursorRippleSlotRef.current;
    cursorRippleEventsRef.current[slot] = {
      origin: [origin[0], origin[1]],
      startedAt: now / 1000,
      active: true
    };
    nextCursorRippleSlotRef.current = (slot + 1) % cursorRippleEventsRef.current.length;

    // Keep drawing until every cursor ring has expanded and faded out.
    if (hoverAnimationFrameRef.current !== null) return;

    const tick = () => {
      if (!imagesReadyRef.current || transitioningRef.current) {
        hoverAnimationFrameRef.current = null;
        return;
      }

      const nowSeconds = performance.now() / 1000;
      const hasActiveRipples = cursorRippleEventsRef.current.some((ripple) => {
        if (ripple.active && nowSeconds - ripple.startedAt >= 1.8) {
          ripple.active = false;
        }
        return ripple.active;
      });

      renderFrame(0, currentIndexRef.current, currentIndexRef.current, lastPointerOriginRef.current);
      if (hasActiveRipples) {
        hoverAnimationFrameRef.current = window.requestAnimationFrame(tick);
      } else {
        hoverAnimationFrameRef.current = null;
      }
    };

    hoverAnimationFrameRef.current = window.requestAnimationFrame(tick);
  }, [interactive, renderFrame]);

  // Initialize WebGL and preload every image in the same effect so resource creation
  // always happens before image uploads. Autoplay waits for this loader to finish.
  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;

    let cancelled = false;
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false
    });
    if (!gl) {
      setWebglSupported(false);
      return;
    }

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vertexShader || !fragmentShader) {
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
      setWebglSupported(false);
      return;
    }

    const program = createProgram(gl, vertexShader, fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!program) {
      setWebglSupported(false);
      return;
    }

    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(program);
      setWebglSupported(false);
      return;
    }
    // Correct UV orientation: pair this with UNPACK_FLIP_Y_WEBGL=1 below
    // so all background images render upright rather than upside down.
    const vertices = new Float32Array([
      -1, -1, 0, 0,
       1, -1, 1, 0,
      -1,  1, 0, 1,
       1,  1, 1, 1
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    resourcesRef.current = {
      gl,
      program,
      buffer,
      positionLocation: gl.getAttribLocation(program, 'a_position'),
      uvLocation: gl.getAttribLocation(program, 'a_uv')
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
        if (imagesReadyRef.current) {
          renderFrame(0, currentIndexRef.current, currentIndexRef.current, [0.5, 0.5]);
        }
      }
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    resize();

    const sourceImages = imagesRef.current;
    const textures = sourceImages.map(() => gl.createTexture());
    texturesRef.current = textures as WebGLTexture[];
    const imageElements: HTMLImageElement[] = [];
    imageElementsRef.current = imageElements;
    let settled = 0;

    const finishOne = () => {
      settled += 1;
      if (settled !== sourceImages.length || cancelled) return;
      imagesReadyRef.current = true;
      setImagesReady(true);
      currentIndexRef.current = 0;
      setCurrentIndex(0);
      renderFrame(0, 0, 0, [0.5, 0.5]);
    };

    if (sourceImages.length === 0) {
      imagesReadyRef.current = false;
      setImagesReady(false);
    } else {
      sourceImages.forEach((src, index) => {
        const texture = textures[index];
        if (!texture) {
          console.error(`[RippleTransition] Could not create texture for image ${index + 1}.`);
          finishOne();
          return;
        }
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
          new Uint8Array([3, 7, 18, 255])
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          if (cancelled) return;
          try {
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            console.info(`[RippleTransition] Loaded image ${index + 1}/${sourceImages.length}: ${src}`);
          } catch (error) {
            console.error(`[RippleTransition] Failed to upload image: ${src}`, error);
          }
          finishOne();
        };
        image.onerror = () => {
          console.error(`[RippleTransition] Failed to load image URL: ${src}`);
          finishOne();
        };
        imageElements.push(image);
        image.src = src;
      });
    }

    const onContextLost = (event: Event) => {
      event.preventDefault();
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
    canvas.addEventListener('webglcontextlost', onContextLost, false);

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (hoverAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(hoverAnimationFrameRef.current);
        hoverAnimationFrameRef.current = null;
      }
      if (autoplayTimerRef.current !== null) {
        window.clearInterval(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
      imageElements.forEach((image) => {
        image.onload = null;
        image.onerror = null;
        image.src = '';
      });
      texturesRef.current.forEach((texture) => {
        if (texture) gl.deleteTexture(texture);
      });
      texturesRef.current = [];
      imageElementsRef.current = [];
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      resourcesRef.current = null;
      imagesReadyRef.current = false;
    };
  }, [renderFrame]);

  // Autoplay starts only after all image URLs have finished loading. This effect is
  // separate from WebGL setup, and uses the stable advance callback above.
  useEffect(() => {
    if (!autoPlay || !isAutoPlayActive || !imagesReady || images.length < 2) return;

    const startTimer = () => {
      if (autoplayTimerRef.current !== null) {
        window.clearInterval(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
      if (!document.hidden) {
        autoplayTimerRef.current = window.setInterval(
          () => advance(),
          Math.max(2000, autoPlayInterval)
        );
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (autoplayTimerRef.current !== null) {
          window.clearInterval(autoplayTimerRef.current);
          autoplayTimerRef.current = null;
        }
      } else {
        startTimer();
      }
    };

    startTimer();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      if (autoplayTimerRef.current !== null) {
        window.clearInterval(autoplayTimerRef.current);
        autoplayTimerRef.current = null;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [autoPlay, isAutoPlayActive, imagesReady, images.length, autoPlayInterval, advance]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    lastPointerOriginRef.current = [
      Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      // WebGL UV coordinates increase upward, while browser pointer Y increases downward.
      1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    ];
    triggerHoverRipple(lastPointerOriginRef.current);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    event.preventDefault();
    handlePointerMove(event);
    transitionTo(currentIndexRef.current + 1, lastPointerOriginRef.current);
  };

  if (!webglSupported) return <WebGLFallback className={className} />;

  return (
    <div
      ref={rootRef}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      className={cn('relative h-full w-full overflow-hidden select-none', interactive && 'cursor-pointer', className)}
      style={{ backgroundColor: background, borderRadius: `${borderRadius}px`, ...style }}
      aria-label={label}
      title={interactive ? 'Click to trigger a ripple transition' : label}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 block h-full w-full"
        style={{ borderRadius: `${borderRadius}px` }}
      />
      {!imagesReady && (
        <div aria-hidden="true" className="absolute inset-0" style={{ backgroundColor: background }} />
      )}
      {renderOverlay ? renderOverlay(currentIndex, isTransitioning) : null}
      {showControls && images.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between p-4 pointer-events-none">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {images.map((image, index) => (
              <button
                key={`${index}-${image}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  transitionTo(index, [0.5, 0.5]);
                }}
                disabled={isTransitioning || !imagesReady}
                aria-label={`Show image ${index + 1}`}
                className={cn(
                  'h-1.5 rounded-full transition-all disabled:opacity-50',
                  currentIndex === index ? 'w-6 bg-cyan-400' : 'w-1.5 bg-slate-500/70'
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIsAutoPlayActive((active) => !active);
              }}
              aria-label={isAutoPlayActive ? 'Pause autoplay' : 'Start autoplay'}
              title={isAutoPlayActive ? 'Pause autoplay' : 'Start autoplay'}
              className="rounded-lg border border-slate-700/70 bg-slate-900/80 p-2 text-slate-200"
            >
              {isAutoPlayActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                advance();
              }}
              disabled={!imagesReady || isTransitioning}
              aria-label="Next ripple transition"
              title="Next ripple transition"
              className="rounded-lg border border-cyan-700/70 bg-cyan-950/80 p-2 text-cyan-200 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const RippleTransition: React.FC<RippleTransitionProps> = (props) => (
  <WebGLErrorBoundary fallback={<WebGLFallback className={props.className} />}>
    <RippleTransitionCanvas {...props} />
  </WebGLErrorBoundary>
);
