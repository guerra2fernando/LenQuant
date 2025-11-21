/* eslint-disable */
// @ts-nocheck
import useSWR from "swr";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { fetcher } from "@/lib/api";
import { SymbolDisplay } from "./CryptoSelector";

export function TradingPairsCard() {
  const { data: overview } = useSWR("/api/admin/overview", fetcher);

  const inventory = overview?.inventory ?? [];
  
  // Get unique symbols
  const uniqueSymbols = Array.from(
    new Set(inventory.map((row: any) => row.symbol))
  ).sort();

  if (uniqueSymbols.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Available Trading Pairs</CardTitle>
        <CardDescription>
          Currently tracking {uniqueSymbols.length} {uniqueSymbols.length === 1 ? "cryptocurrency" : "cryptocurrencies"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {uniqueSymbols.slice(0, 8).map((symbol: string) => (
            <div key={symbol} className="flex items-center gap-1.5">
              <SymbolDisplay symbol={symbol} />
            </div>
          ))}
          {uniqueSymbols.length > 8 && (
            <Badge variant="outline">+{uniqueSymbols.length - 8} more</Badge>
          )}
        </div>
        
        <Link href="/get-started">
          <Button variant="outline" size="sm" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Add More Symbols
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

