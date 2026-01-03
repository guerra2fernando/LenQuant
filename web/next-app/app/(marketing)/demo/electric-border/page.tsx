import { ElectricBorderDemo } from "@/components/marketing/ElectricBorderDemo";

// Force dynamic rendering to avoid static generation timeout
export const dynamic = 'force-dynamic';

export default function ElectricBorderDemoPage() {
  return <ElectricBorderDemo />;
}
