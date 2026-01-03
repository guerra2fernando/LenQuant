import { useEffect } from "react";
import { useRouter } from "next/router";

export default function AutonomySettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings?tab=autonomy");
  }, [router]);

  return null;
}

// Force server-side rendering to avoid static generation issues
export const getServerSideProps = () => ({ props: {} });