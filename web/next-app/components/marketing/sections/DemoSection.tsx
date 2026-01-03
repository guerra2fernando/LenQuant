"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics";

export function DemoSection() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  const handlePlayClick = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      analytics.watchVideo("homepage_demo", "play");
    }
  };

  return (
    <section className="section-padding">
      <div className="container-marketing">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-12"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground">
            See LenQuant{" "}
            <span className="text-gradient">in Action</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Watch how traders use LenQuant to make more disciplined trading
            decisions on Binance Futures.
          </p>
        </motion.div>

        {/* Video Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative max-w-4xl mx-auto"
        >
          {/* Video Wrapper with Glow */}
          <div className="relative rounded-2xl overflow-hidden border border-border/50 bg-black/50 glow-card">
            {/* Aspect Ratio Container */}
            <div className="relative aspect-video">
              {/* PLACEHOLDER: Replace with actual video */}
              {/*
              <video
                src="/videos/demo.mp4"
                poster="/images/marketing/video-poster.png"
                className="w-full h-full object-cover"
                muted={isMuted}
                playsInline
                loop
                ref={(el) => {
                  if (el) {
                    isPlaying ? el.play() : el.pause();
                  }
                }}
              />
              */}

              {/* Option 2: YouTube Embed */}
              {/*
              <iframe
                src="https://www.youtube.com/embed/VIDEO_ID?autoplay=0&modestbranding=1&rel=0"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              */}

              {/* Placeholder Image */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-indigo-900/50 flex items-center justify-center">
                {/* PLACEHOLDER: Replace with actual poster image */}
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto mb-4 cursor-pointer hover:bg-white/20 transition-colors group">
                    <Play className="w-8 h-8 text-white ml-1 group-hover:scale-110 transition-transform" />
                  </div>
                  <p className="text-white/70 text-sm">
                    Video placeholder — 3:30 min demo
                  </p>
                </div>
              </div>

              {/* Video Controls Overlay (shown when video is available) */}
              {false && (
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20"
                        onClick={handlePlayClick}
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20"
                        onClick={() => setIsMuted(!isMuted)}
                      >
                        {isMuted ? (
                          <VolumeX className="w-5 h-5" />
                        ) : (
                          <Volume2 className="w-5 h-5" />
                        )}
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20"
                    >
                      <Maximize className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Decorative glow behind video */}
          <div className="absolute -inset-4 bg-purple-500/20 rounded-3xl blur-3xl -z-10" />
        </motion.div>
      </div>
    </section>
  );
}
