import { ChangeEvent } from "react";

import { Input } from "@/components/ui/input";

type KnowledgeSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function KnowledgeSearchInput({ value, onChange, placeholder = "Search knowledge base…" }: KnowledgeSearchInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };
  return <Input value={value} onChange={handleChange} placeholder={placeholder} aria-label="Search knowledge base" />;
}

