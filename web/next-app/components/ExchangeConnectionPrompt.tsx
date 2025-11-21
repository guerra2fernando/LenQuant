/* eslint-disable */
// @ts-nocheck
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Plug, AlertCircle, ArrowRight } from "lucide-react";
import { fetcher } from "@/lib/api";
import { useRouter } from "next/router";
import { useState } from "react";
import { ExchangeConnectionModal } from "./ExchangeConnectionModal";

interface ExchangeConnectionPromptProps {
  context?: "portfolio" | "dashboard" | "risk";
  compact?: boolean;
}

export function ExchangeConnectionPrompt({ context = "portfolio", compact = false }: ExchangeConnectionPromptProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const { data, mutate } = useSWR("/api/exchange/status", fetcher, {
    refreshInterval: 30000,
  });

  // Check if live trading is enabled (any exchange connected)
  const isConnected = data?.live_trading_enabled === true;

  // Don't show if already connected
  if (isConnected) {
    return null;
  }

  const contextMessages = {
    portfolio: {
      title: "Enable Live Trading",
      description: "Connect your exchange to start trading with real money",
      cta: "Connect Exchange",
      details: "You're currently in Paper Trading mode. Connect your Binance account to enable live trading with real funds. All your strategies and settings will remain the same.",
    },
    dashboard: {
      title: "Connect Your Exchange",
      description: "Enable live trading by connecting Binance",
      cta: "Setup Exchange",
      details: "Want to trade with real money? Connect your exchange account to unlock live trading mode.",
    },
    risk: {
      title: "Exchange Not Connected",
      description: "Live trading is disabled",
      cta: "Connect Now",
      details: "Risk monitoring for live trades requires an exchange connection. Connect your Binance account to enable full risk tracking.",
    },
  };

  const message = contextMessages[context];

  const handleConnect = () => {
    if (context === "dashboard") {
      router.push("/settings?tab=trading");
    } else {
      setShowModal(true);
    }
  };

  if (compact) {
    return (
      <>
        <Alert className="border-primary/50 bg-primary/5">
          <Plug className="h-4 w-4" />
          <div className="ml-2 flex items-center justify-between flex-1">
            <div>
              <p className="text-sm font-medium">{message.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{message.description}</p>
            </div>
            <Button size="sm" onClick={handleConnect}>
              {message.cta}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Alert>

        {context !== "dashboard" && (
          <ExchangeConnectionModal
            open={showModal}
            onOpenChange={setShowModal}
            onConnectionSuccess={mutate}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Plug className="h-5 w-5" />
                {message.title}
              </CardTitle>
              <CardDescription className="mt-1">
                {message.description}
              </CardDescription>
            </div>
            <AlertCircle className="h-5 w-5 text-primary" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {message.details}
          </p>

          <div className="flex gap-2">
            <Button onClick={handleConnect} className="flex-1">
              <Plug className="mr-2 h-4 w-4" />
              {message.cta}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push("/settings?tab=trading")}
            >
              Learn More
            </Button>
          </div>

          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <p className="flex items-start gap-2">
              <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>
                Your API keys are encrypted and stored securely. You maintain full control of your funds at all times.
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {context !== "dashboard" && (
        <ExchangeConnectionModal
          open={showModal}
          onOpenChange={setShowModal}
          onConnectionSuccess={mutate}
        />
      )}
    </>
  );
}

