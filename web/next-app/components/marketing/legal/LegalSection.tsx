import { ReactNode } from "react";

interface LegalSectionProps {
  id: string;
  title: string;
  children: ReactNode;
}

export function LegalSection({ id, title, children }: LegalSectionProps) {
  return (
    <section id={id} className="scroll-mt-24 mb-10">
      <h2 className="text-xl md:text-2xl font-display font-semibold text-foreground mb-4">
        {title}
      </h2>
      <div className="text-muted-foreground space-y-4">{children}</div>
    </section>
  );
}


