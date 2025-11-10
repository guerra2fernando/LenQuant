/* eslint-disable */
// @ts-nocheck
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MFAChallengeProps = {
  onVerify: (code: string) => Promise<void>;
  disabled?: boolean;
};

export function MFAChallenge({ onVerify, disabled = false }: MFAChallengeProps) {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!code.trim()) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onVerify(code.trim());
      setCode("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={code}
        disabled={disabled || isSubmitting}
        placeholder="Enter MFA code"
        onChange={(event) => setCode(event.target.value)}
      />
      <Button disabled={disabled || isSubmitting} onClick={handleSubmit}>
        Verify
      </Button>
    </div>
  );
}

