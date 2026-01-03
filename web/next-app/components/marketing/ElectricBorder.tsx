"use client";

import { useEffect, useRef, useCallback } from "react";

interface ElectricBorderProps {
  /** Width of the content area (border will extend beyond) */
  width?: number;
  /** Height of the content area (border will extend beyond) */
  height?: number;
  /** Color of the electric border (hex format) */
  color?: string;
  /** Animation speed multiplier */
  speed?: number;
  /** Border radius in pixels */
  borderRadius?: number;
  /** Additional CSS classes */
  className?: string;
  /** Offset from content edge */
  borderOffset?: number;
  /** Line width of the border stroke */
  lineWidth?: number;
  /** Displacement intensity of the noise effect */
  displacement?: number;
  /** Whether to pause animation when not visible */
  pauseWhenHidden?: boolean;
  /** Whether to enable secondary pink border */
  enableSecondary?: boolean;
  /** Color of the secondary border */
  secondaryColor?: string;
  /** Animation speed for secondary border */
  secondarySpeed?: number;
  /** Displacement for secondary border */
  secondaryDisplacement?: number;
  /** Phase offset for secondary border animation */
  secondaryPhaseOffset?: number;
}

export function ElectricBorder({
  width = 366,
  height = 519,
  color = "#8B5CF6",
  speed = 0.8,
  borderRadius = 54,
  className = "",
  borderOffset = 90,
  lineWidth = 1.8,
  displacement = 90,
  pauseWhenHidden = true,
  enableSecondary = true,
  secondaryColor = "#FF69B4",
  secondarySpeed = 0.6,
  secondaryDisplacement = 65,
  secondaryPhaseOffset = Math.PI,
}: ElectricBorderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const secondaryCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const secondaryAnimationRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const secondaryTimeRef = useRef(secondaryPhaseOffset);
  const lastFrameTimeRef = useRef(performance.now());
  const secondaryLastFrameTimeRef = useRef(performance.now());
  const isVisibleRef = useRef(true);

  // Configuration
  const config = {
    octaves: 20,
    lacunarity: 1.6,
    gain: 0.6,
    amplitude: 0.075,
    frequency: 10,
    baseFlatness: 0,
    displacement,
    speed,
    borderOffset,
    borderRadius,
    lineWidth,
    color,
  };

  // Noise functions
  const random = useCallback((x: number): number => {
    return (Math.sin(x * 12.9898) * 43758.5453) % 1;
  }, []);

  const noise2D = useCallback(
    (x: number, y: number): number => {
      const i = Math.floor(x);
      const j = Math.floor(y);
      const fx = x - i;
      const fy = y - j;

      const a = random(i + j * 57);
      const b = random(i + 1 + j * 57);
      const c = random(i + (j + 1) * 57);
      const d = random(i + 1 + (j + 1) * 57);

      const ux = fx * fx * (3.0 - 2.0 * fx);
      const uy = fy * fy * (3.0 - 2.0 * fy);

      return (
        a * (1 - ux) * (1 - uy) +
        b * ux * (1 - uy) +
        c * (1 - ux) * uy +
        d * ux * uy
      );
    },
    [random]
  );

  const octavedNoise = useCallback(
    (
      x: number,
      octaves: number,
      lacunarity: number,
      gain: number,
      baseAmplitude: number,
      baseFrequency: number,
      time: number,
      seed: number,
      baseFlatness: number
    ): number => {
      let y = 0;
      let amplitude = baseAmplitude;
      let frequency = baseFrequency;

      for (let i = 0; i < octaves; i++) {
        let octaveAmplitude = amplitude;
        if (i === 0) octaveAmplitude *= baseFlatness;
        y +=
          octaveAmplitude *
          noise2D(frequency * x + seed * 100, time * frequency * 0.3);
        frequency *= lacunarity;
        amplitude *= gain;
      }

      return y;
    },
    [noise2D]
  );

  // Get point on rounded rectangle perimeter
  const getRoundedRectPoint = useCallback(
    (
      t: number,
      left: number,
      top: number,
      rectWidth: number,
      rectHeight: number,
      radius: number
    ): { x: number; y: number } => {
      const straightWidth = rectWidth - 2 * radius;
      const straightHeight = rectHeight - 2 * radius;
      const cornerArc = (Math.PI * radius) / 2;
      const totalPerimeter =
        2 * straightWidth + 2 * straightHeight + 4 * cornerArc;
      const distance = t * totalPerimeter;

      let accumulated = 0;

      // Top edge
      if (distance <= accumulated + straightWidth) {
        const progress = (distance - accumulated) / straightWidth;
        return { x: left + radius + progress * straightWidth, y: top };
      }
      accumulated += straightWidth;

      // Top-right corner
      if (distance <= accumulated + cornerArc) {
        const progress = (distance - accumulated) / cornerArc;
        const angle = -Math.PI / 2 + progress * (Math.PI / 2);
        return {
          x: left + rectWidth - radius + radius * Math.cos(angle),
          y: top + radius + radius * Math.sin(angle),
        };
      }
      accumulated += cornerArc;

      // Right edge
      if (distance <= accumulated + straightHeight) {
        const progress = (distance - accumulated) / straightHeight;
        return {
          x: left + rectWidth,
          y: top + radius + progress * straightHeight,
        };
      }
      accumulated += straightHeight;

      // Bottom-right corner
      if (distance <= accumulated + cornerArc) {
        const progress = (distance - accumulated) / cornerArc;
        const angle = progress * (Math.PI / 2);
        return {
          x: left + rectWidth - radius + radius * Math.cos(angle),
          y: top + rectHeight - radius + radius * Math.sin(angle),
        };
      }
      accumulated += cornerArc;

      // Bottom edge
      if (distance <= accumulated + straightWidth) {
        const progress = (distance - accumulated) / straightWidth;
        return {
          x: left + rectWidth - radius - progress * straightWidth,
          y: top + rectHeight,
        };
      }
      accumulated += straightWidth;

      // Bottom-left corner
      if (distance <= accumulated + cornerArc) {
        const progress = (distance - accumulated) / cornerArc;
        const angle = Math.PI / 2 + progress * (Math.PI / 2);
        return {
          x: left + radius + radius * Math.cos(angle),
          y: top + rectHeight - radius + radius * Math.sin(angle),
        };
      }
      accumulated += cornerArc;

      // Left edge
      if (distance <= accumulated + straightHeight) {
        const progress = (distance - accumulated) / straightHeight;
        return {
          x: left,
          y: top + rectHeight - radius - progress * straightHeight,
        };
      }
      accumulated += straightHeight;

      // Top-left corner
      const progress = (distance - accumulated) / cornerArc;
      const angle = Math.PI + progress * (Math.PI / 2);
      return {
        x: left + radius + radius * Math.cos(angle),
        y: top + radius + radius * Math.sin(angle),
      };
    },
    []
  );

  // Generic draw function for borders
  const drawBorder = useCallback((
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    time: number,
    borderColor: string,
    borderSpeed: number,
    borderDisplacement: number,
    phaseOffset: number = 0
  ) => {
    const canvasWidth = width + config.borderOffset * 2;
    const canvasHeight = height + config.borderOffset * 2;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = config.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const left = config.borderOffset;
    const top = config.borderOffset;
    const borderWidth = canvasWidth - 2 * config.borderOffset;
    const borderHeight = canvasHeight - 2 * config.borderOffset;
    const maxRadius = Math.min(borderWidth, borderHeight) / 2;
    const radius = Math.min(config.borderRadius, maxRadius);

    const approximatePerimeter =
      2 * (borderWidth + borderHeight) + 2 * Math.PI * radius;
    const sampleCount = Math.floor(approximatePerimeter / 2);

    ctx.beginPath();

    for (let i = 0; i <= sampleCount; i++) {
      const progress = i / sampleCount;
      const point = getRoundedRectPoint(
        progress,
        left,
        top,
        borderWidth,
        borderHeight,
        radius
      );

      const xNoise = octavedNoise(
        progress * 8 + phaseOffset,
        config.octaves,
        config.lacunarity,
        config.gain,
        config.amplitude,
        config.frequency,
        time * borderSpeed,
        0,
        config.baseFlatness
      );

      const yNoise = octavedNoise(
        progress * 8 + phaseOffset,
        config.octaves,
        config.lacunarity,
        config.gain,
        config.amplitude,
        config.frequency,
        time * borderSpeed,
        1,
        config.baseFlatness
      );

      const displacedX = point.x + xNoise * borderDisplacement;
      const displacedY = point.y + yNoise * borderDisplacement;

      if (i === 0) {
        ctx.moveTo(displacedX, displacedY);
      } else {
        ctx.lineTo(displacedX, displacedY);
      }
    }

    ctx.closePath();
    ctx.stroke();
  }, [width, height, config, octavedNoise, getRoundedRectPoint]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    const canvasWidth = width + config.borderOffset * 2;
    const canvasHeight = height + config.borderOffset * 2;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Visibility observer for performance
    let observer: IntersectionObserver | null = null;
    if (pauseWhenHidden) {
      observer = new IntersectionObserver(
        (entries) => {
          isVisibleRef.current = entries[0]?.isIntersecting ?? true;
        },
        { threshold: 0.1 }
      );
      observer.observe(canvas);
    }

    const draw = (currentTime: number) => {
      if (!isVisibleRef.current && pauseWhenHidden) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      const deltaTime = (currentTime - lastFrameTimeRef.current) / 1000;
      timeRef.current += deltaTime * config.speed;
      lastFrameTimeRef.current = currentTime;

      drawBorder(canvas, ctx, timeRef.current, config.color, config.speed, config.displacement);

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    // Secondary border setup
    let secondaryCtx: CanvasRenderingContext2D | null = null;
    let secondaryCanvas: HTMLCanvasElement | null = null;

    if (enableSecondary) {
      secondaryCanvas = secondaryCanvasRef.current;
      if (secondaryCanvas) {
        secondaryCtx = secondaryCanvas.getContext("2d");
        if (secondaryCtx) {
          secondaryCanvas.width = canvasWidth;
          secondaryCanvas.height = canvasHeight;

          const drawSecondary = (currentTime: number) => {
            if (!isVisibleRef.current && pauseWhenHidden) {
              secondaryAnimationRef.current = requestAnimationFrame(drawSecondary);
              return;
            }

            const deltaTime = (currentTime - secondaryLastFrameTimeRef.current) / 1000;
            secondaryTimeRef.current += deltaTime * secondarySpeed;
            secondaryLastFrameTimeRef.current = currentTime;

            drawBorder(secondaryCanvas!, secondaryCtx!, secondaryTimeRef.current, secondaryColor, secondarySpeed, secondaryDisplacement, secondaryPhaseOffset);

            secondaryAnimationRef.current = requestAnimationFrame(drawSecondary);
          };

          secondaryLastFrameTimeRef.current = performance.now();
          secondaryAnimationRef.current = requestAnimationFrame(drawSecondary);
        }
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (secondaryAnimationRef.current) {
        cancelAnimationFrame(secondaryAnimationRef.current);
      }
      if (observer) {
        observer.disconnect();
      }
    };
  }, [
    width,
    height,
    config.borderOffset,
    config.speed,
    config.color,
    config.lineWidth,
    config.borderRadius,
    config.displacement,
    config.octaves,
    config.lacunarity,
    config.gain,
    config.amplitude,
    config.frequency,
    config.baseFlatness,
    octavedNoise,
    getRoundedRectPoint,
    pauseWhenHidden,
    enableSecondary,
    secondaryColor,
    secondarySpeed,
    secondaryDisplacement,
    secondaryPhaseOffset,
    drawBorder,
  ]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none ${className}`}
        style={{
          width: width + borderOffset * 2.15,
          height: height + borderOffset * 2.15,
          zIndex: 20,
          marginLeft: '-1px',
        }}
        aria-hidden="true"
      />
      {enableSecondary && (
        <canvas
          ref={secondaryCanvasRef}
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none ${className}`}
          style={{
            width: width + borderOffset * 2.15,
            height: height + borderOffset * 2.15,
            zIndex: 21,
            marginLeft: '-1px',
          }}
          aria-hidden="true"
        />
      )}
    </>
  );
}
