"use client";

import { motion } from "framer-motion";
import { TestimonialCard } from "@/components/marketing/TestimonialCard";

const testimonials = [
  {
    quote:
      "Finally, an objective voice when I'm tempted to overtrade. The leverage warnings alone have saved me from several bad positions.",
    author: "@crypto_trader_anon",
    role: "Binance Futures Trader",
    rating: 5,
  },
  {
    quote:
      "I was skeptical at first, but the regime detection is actually solid. It uses real technical analysis, not just simple indicators.",
    author: "Early Beta Tester",
    role: "3 years trading experience",
    rating: 5,
  },
  {
    quote:
      "The AI explanations are surprisingly useful. It's like having a trading mentor explain the market conditions before every trade.",
    author: "Premium User",
    role: "Part-time trader",
    rating: 5,
  },
];

export function TestimonialsSection() {
  return (
    <section className="section-padding bg-muted/20">
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
            What Traders Are{" "}
            <span className="text-gradient">Saying</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Real feedback from traders using LenQuant every day.
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid md:grid-cols-3 gap-6"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <TestimonialCard {...testimonial} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
