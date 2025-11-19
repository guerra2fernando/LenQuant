/* eslint-disable */
// @ts-nocheck
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function ExperimentSettingsPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      router.replace("/settings?tab=experiments");
    }
  }, [router]);

  return null;
}

export async function getStaticProps() {
  return {
    props: {},
  };
}
