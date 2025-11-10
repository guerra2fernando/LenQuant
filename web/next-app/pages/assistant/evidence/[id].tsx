/* eslint-disable */
// @ts-nocheck
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetcher } from "@/lib/api";

function formatJson(value: any) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

export default function EvidenceDetailPage() {
  const router = useRouter();
  const evidenceId = typeof router.query.id === "string" ? router.query.id : "";

  const [namespace, identifier] = evidenceId.includes("/") ? evidenceId.split("/", 2) : [evidenceId, ""];
  const encodedNamespace = encodeURIComponent(namespace);
  const encodedIdentifier = encodeURIComponent(identifier);

  const shouldFetch = namespace && identifier;
  const { data, error, isValidating } = useSWR(
    shouldFetch ? `/api/assistant/evidence/${encodedNamespace}/${encodedIdentifier}` : null,
    fetcher,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Evidence detail</h1>
        <Link href="/assistant" className="text-sm font-medium text-primary underline">
          Back to assistant
        </Link>
      </div>
      {!shouldFetch && <p className="text-sm text-muted-foreground">Invalid evidence reference.</p>}
      {isValidating && <p className="text-xs text-muted-foreground">Loading evidence…</p>}
      {error && <p className="text-sm text-red-500">Failed to load evidence: {error?.message ?? "Error"}</p>}
      {data?.document && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {namespace} / {identifier}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[70vh] overflow-auto whitespace-pre text-xs leading-relaxed text-muted-foreground">
              {formatJson(data.document)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

