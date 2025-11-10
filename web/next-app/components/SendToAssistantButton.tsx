import type { ReactNode } from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";

type Props = {
  prompt: string;
  children?: ReactNode;
};

export function SendToAssistantButton({ prompt, children }: Props) {
  const href = `/assistant?prompt=${encodeURIComponent(prompt)}`;
  return (
    <Link href={href}>
      <Button variant="secondary">{children ?? "Ask Assistant"}</Button>
    </Link>
  );
}

