"use client";

import { useIsMobile, usePrefersReducedMotion } from "@/hooks/useMediaQuery";
import { ElectricBorderCard } from "./ElectricBorderCard";

interface ResponsiveElectricCardProps {
  children: React.ReactNode;
  mobileWidth?: number;
  mobileHeight?: number;
  desktopWidth?: number;
  desktopHeight?: number;
}

export function ResponsiveElectricCard({
  children,
  mobileWidth = 300,
  mobileHeight = 400,
  desktopWidth = 450,
  desktopHeight = 600,
}: ResponsiveElectricCardProps) {
  const isMobile = useIsMobile();
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <ElectricBorderCard
      width={isMobile ? mobileWidth : desktopWidth}
      height={isMobile ? mobileHeight : desktopHeight}
      showEffect={!prefersReducedMotion}
      speed={isMobile ? 1 : 1.5}
      displacement={isMobile ? 40 : 60}
    >
      {children}
    </ElectricBorderCard>
  );
}
