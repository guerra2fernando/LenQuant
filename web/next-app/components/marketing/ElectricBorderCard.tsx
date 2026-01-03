"use client";

import { ReactNode, useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ElectricBorder } from "./ElectricBorder";

interface ElectricBorderCardProps {
  children: ReactNode;
  /** Width of the card content area */
  width?: number;
  /** Height of the card content area */
  height?: number;
  /** Color of the electric border (the animated zaps) */
  color?: string;
  /** Color of the card border/gradient (separate from electric color) */
  borderColor?: string;
  /** Animation speed */
  speed?: number;
  /** Border radius */
  borderRadius?: number;
  /** Whether to show the electric effect (can disable on mobile) */
  showEffect?: boolean;
  /** Additional CSS classes for the outer container */
  className?: string;
  /** Additional CSS classes for the content area */
  contentClassName?: string;
  /** Whether to auto-size based on content */
  autoSize?: boolean;
  /** Displacement intensity of the noise effect */
  displacement?: number;
}

export function ElectricBorderCard({
  children,
  width = 354,
  height = 504,
  color = "#8B5CF6",
  borderColor = "#6366F1",
  speed = 1.5,
  borderRadius = 24,
  showEffect = false,
  className = "",
  contentClassName = "",
  autoSize = false,
  displacement = 60,
}: ElectricBorderCardProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width, height });

  useEffect(() => {
    if (!autoSize || !contentRef.current) return;

    const updateDimensions = () => {
      if (contentRef.current) {
        setDimensions({
          width: contentRef.current.offsetWidth,
          height: contentRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(contentRef.current);

    return () => resizeObserver.disconnect();
  }, [autoSize]);

  const finalWidth = autoSize ? dimensions.width : width;
  const finalHeight = autoSize ? dimensions.height : height;

  return (
    <div
      className={cn("relative", className)}
      style={
        !autoSize
          ? {
              width: finalWidth,
              height: finalHeight,
            }
          : undefined
      }
    >
      {/* Card container with gradient border */}
      <div
        className="relative p-[2px] rounded-[--radius]"
        style={
          {
            "--radius": `${borderRadius}px`,
            background: `linear-gradient(
              -30deg,
              oklch(from ${borderColor} 0.3 calc(c / 2) h / 0.4),
              transparent,
              oklch(from ${borderColor} 0.3 calc(c / 2) h / 0.4)
            ),
            linear-gradient(
              to bottom,
              hsl(0 0% 11%),
              hsl(0 0% 11%)
            )`,
          } as React.CSSProperties
        }
      >
        {/* Inner container */}
        <div className="relative">
          {/* Canvas container */}
          <div
            className="relative"
            style={{
              width: finalWidth,
              height: finalHeight,
            }}
          >
            {/* Electric border canvas - positioned on top */}
            {showEffect && (
              <ElectricBorder
                width={finalWidth}
                height={finalHeight}
                color={color}
                speed={speed}
                borderRadius={borderRadius}
                displacement={displacement}
                className="z-20"
              />
            )}
          </div>

          {/* Glow layers - using borderColor for card glow */}
          <div
            className="absolute inset-0 pointer-events-none animate-pulse-glow z-10"
            style={{
              border: `2px solid ${borderColor}60`,
              borderRadius: `${borderRadius}px`,
              filter: "blur(1px)",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none z-10"
            style={{
              border: `2px solid ${borderColor}`,
              borderRadius: `${borderRadius}px`,
              filter: "blur(4px)",
            }}
          />

          {/* Background glow - using borderColor */}
          <div
            className="absolute inset-0 pointer-events-none -z-10"
            style={{
              borderRadius: `${borderRadius}px`,
              filter: "blur(32px)",
              transform: "scale(1.1)",
              opacity: 0.3,
              background: `linear-gradient(-30deg, ${borderColor}, transparent, ${borderColor})`,
            }}
          />

          {/* Content container */}
          <div
            ref={contentRef}
            className={cn(
              "absolute inset-0 flex flex-col z-10",
              contentClassName
            )}
            style={{
              borderRadius: `${borderRadius}px`,
            }}
          >
            {children}
          </div>
        </div>

        {/* Subtle top glow overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-30"
          style={{
            borderRadius: `${borderRadius}px`,
            filter: "blur(24px)",
            background: `linear-gradient(to bottom, ${borderColor}20, transparent 40%)`,
            opacity: 0.6,
          }}
        />
      </div>
    </div>
  );
}
