"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { analytics } from "@/lib/analytics";

interface Screenshot {
  id: string;
  src: string;
  alt: string;
  caption: string;
  description: string;
}

interface ScreenshotCarouselProps {
  screenshots: Screenshot[];
}

export function ScreenshotCarousel({ screenshots }: ScreenshotCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev === 0 ? screenshots.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === screenshots.length - 1 ? 0 : prev + 1));
  };

  const handleThumbnailClick = (index: number) => {
    setActiveIndex(index);
    analytics.viewScreenshot(screenshots[index].id, screenshots[index].alt);
  };

  return (
    <div className="space-y-6">
      {/* Main Image */}
      <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-border/50 bg-card/50">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
          >
            {/* PLACEHOLDER: Replace with actual screenshots */}
            <div className="w-full h-full bg-gradient-to-br from-purple-900/30 to-indigo-900/30 flex items-center justify-center">
              <div className="text-center p-8">
                <p className="text-muted-foreground">
                  Screenshot: {screenshots[activeIndex].caption}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-2">
                  {screenshots[activeIndex].alt}
                </p>
              </div>
            </div>
            {/* Uncomment when images are ready:
            <Image
              src={screenshots[activeIndex].src}
              alt={screenshots[activeIndex].alt}
              fill
              className="object-cover"
              priority={activeIndex === 0}
            />
            */}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
          onClick={handlePrev}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
          onClick={handleNext}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Caption */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">
          {screenshots[activeIndex].caption}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {screenshots[activeIndex].description}
        </p>
      </div>

      {/* Thumbnails */}
      <div className="flex justify-center gap-3">
        {screenshots.map((screenshot, index) => (
          <button
            key={screenshot.id}
            onClick={() => handleThumbnailClick(index)}
            className={cn(
              "w-20 h-14 rounded-lg overflow-hidden border-2 transition-all",
              index === activeIndex
                ? "border-purple-500 ring-2 ring-purple-500/30"
                : "border-border/50 opacity-60 hover:opacity-100"
            )}
          >
            {/* PLACEHOLDER: Replace with actual thumbnails */}
            <div className="w-full h-full bg-gradient-to-br from-purple-900/30 to-indigo-900/30" />
            {/* Uncomment when images are ready:
            <Image
              src={screenshot.src}
              alt={screenshot.alt}
              width={80}
              height={56}
              className="object-cover w-full h-full"
            />
            */}
          </button>
        ))}
      </div>
    </div>
  );
}
