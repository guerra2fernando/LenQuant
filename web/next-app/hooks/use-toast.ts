/* eslint-disable */
// @ts-nocheck
import { toast as sonnerToast } from "sonner";

type ToastProps = {
  title: string;
  description?: string;
  duration?: number;
  variant?: "default" | "destructive";
};

export function useToast() {
  const toast = ({ title, description, duration = 5000, variant }: ToastProps) => {
    if (variant === "destructive") {
      sonnerToast.error(title, {
        description,
        duration,
      });
    } else {
      sonnerToast(title, {
        description,
        duration,
      });
    }
  };

  return { toast };
}

