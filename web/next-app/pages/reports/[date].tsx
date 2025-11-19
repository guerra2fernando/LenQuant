/* eslint-disable */
// @ts-nocheck
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { fetcher } from "@/lib/api";

type StrategyRow = {
  strategy: string;
  pnl?: number;
  sharpe?: number;
  trades?: number;
};

type ReportChart = {
  path: string;
  label?: string;
};

type ReportDetail = {
  date: string;
  summary?: string;
  top_strategies?: StrategyRow[];
  charts?: ReportChart[];
  raw?: unknown;
};

export default function ReportDetailPage(): JSX.Element {
  const router = useRouter();
  const { date } = router.query;

  const {
    data,
    error,
    isLoading,
    mutate: refetchReport,
  } = useSWR<ReportDetail>(
    () => (typeof date === "string" ? `/api/reports/${date}` : null),
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/reports" className="inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          {typeof date === "string" ? (
            <h1 className="text-xl font-semibold text-foreground">Report · {date}</h1>
          ) : (
            <h1 className="text-xl font-semibold text-foreground">Report</h1>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void refetchReport();
          }}
        >
          Refresh
        </Button>
      </header>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Fetching report&hellip;
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <CardContent className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-sm text-destructive-foreground">
            Unable to load report. {error instanceof Error ? error.message : "Unknown error"}
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{data.date}</CardTitle>
              <CardDescription>{data.summary || "No summary provided for this report."}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{`Top strategies: ${data.top_strategies?.length ?? 0}`}</Badge>
                <Badge variant="secondary">{`Charts: ${data.charts?.length ?? 0}`}</Badge>
              </div>
            </CardContent>
          </Card>

          {data.top_strategies?.length ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Top Strategies
                  <TooltipExplainer 
                    term="Top Strategies" 
                    explanation="The best-performing trading strategies for this specific day, ranked by profit/loss. Shows which strategies made the most money and their key metrics like Sharpe ratio (risk-adjusted returns) and number of trades executed. This helps identify consistently strong performers worth allocating more capital to."
                  />
                </CardTitle>
                <CardDescription>Ranked by reported profit and loss for the day.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Strategy</TableHead>
                      <TableHead className="text-right">PnL</TableHead>
                      <TableHead className="text-right">Sharpe</TableHead>
                      <TableHead className="text-right">Trades</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.top_strategies.map((item) => (
                      <TableRow key={item.strategy}>
                        <TableCell className="font-medium text-foreground">{item.strategy}</TableCell>
                        <TableCell className="text-right font-mono">{(item.pnl ?? 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {item.sharpe !== undefined ? item.sharpe.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {item.trades ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {data.charts?.length ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Artifacts
                  <TooltipExplainer 
                    term="Report Artifacts" 
                    explanation="Generated charts and visualizations created by the reporting pipeline for this day. These may include equity curves, performance heatmaps, correlation matrices, or other analytical visuals. Artifacts provide visual insights that complement the numerical data in the report, making patterns easier to spot."
                  />
                </CardTitle>
                <CardDescription>Links to generated chart assets for this report.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {data.charts.map((chart) => {
                    const label = chart.label ?? chart.path.split("/").pop() ?? chart.path;
                    return (
                      <li key={chart.path}>
                        <a
                          href={chart.path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-primary transition-colors hover:underline"
                        >
                          {label}
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {data.raw ? (
            <Card>
              <CardHeader>
                <CardTitle>Raw payload</CardTitle>
                <CardDescription>Serialized response returned by the reporting pipeline.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[420px] overflow-auto rounded-md bg-muted/50 p-4 text-xs text-muted-foreground">
                  {JSON.stringify(data.raw, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export async function getStaticPaths() {
  // Return empty paths array to prevent static generation of all paths
  // This page will be generated on-demand
  return {
    paths: [],
    fallback: 'blocking',
  };
}

export async function getStaticProps() {
  return {
    props: {},
  };
}

