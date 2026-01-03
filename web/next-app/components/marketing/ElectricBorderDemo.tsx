"use client";

import { ElectricBorderCard } from "./ElectricBorderCard";
import { GlassButton } from "./GlassButton";

export function ElectricBorderDemo() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-8">
      <ElectricBorderCard
        width={354}
        height={504}
        color="#8B5CF6"
        borderColor="#3B82F6"
        speed={1.5}
        borderRadius={24}
        showEffect={true}
      >
        {/* Content Top */}
        <div className="flex flex-col p-12 pb-4 h-full">
          <GlassButton size="sm">
            Dramatic
          </GlassButton>
          <h2 className="text-4xl font-display font-medium mt-auto text-white">
            Electric Border
          </h2>
        </div>

        {/* Divider */}
        <hr
          className="border-none h-[1px] mx-12"
          style={{
            background: "currentColor",
            opacity: 0.1,
            maskImage: "linear-gradient(to right, transparent, black, transparent)",
            WebkitMaskImage: "linear-gradient(to right, transparent, black, transparent)",
          }}
        />

        {/* Content Bottom */}
        <div className="flex flex-col p-12 pt-4">
          <p className="text-white/50">
            In case you'd like to emphasize something very dramatically.
          </p>
        </div>
      </ElectricBorderCard>
    </div>
  );
}
