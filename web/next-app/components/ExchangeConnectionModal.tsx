/* eslint-disable */
// @ts-nocheck
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2, ExternalLink, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { postJson } from "@/lib/api";

interface ExchangeConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnectionSuccess?: () => void;
}

export function ExchangeConnectionModal({ open, onOpenChange, onConnectionSuccess }: ExchangeConnectionModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    permissions?: string[];
    balance?: any;
    error?: string;
  } | null>(null);

  const handleValidateConnection = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      toast.error("Please enter both API Key and API Secret");
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const response = await postJson("/api/exchange/validate", {
        exchange: "binance",
        api_key: apiKey,
        api_secret: apiSecret,
        testnet: false,  // Default to production, can add toggle later
      });

      if (response.valid) {
        setValidationResult({
          success: true,
          permissions: response.permissions || [],
          balance: { usd: response.balance_usd || 0 },
        });
        toast.success("Connection validated successfully!");
      } else {
        setValidationResult({
          success: false,
          error: response.error || "Unknown validation error",
        });
        toast.error(response.error || "Validation failed");
      }
    } catch (error) {
      setValidationResult({
        success: false,
        error: error.message || "Failed to connect to Binance",
      });
      toast.error("Failed to validate connection");
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveConnection = async () => {
    if (!validationResult?.success) {
      toast.error("Please validate the connection first");
      return;
    }

    try {
      await postJson("/api/exchange/connect", {
        exchange: "binance",
        api_key: apiKey,
        api_secret: apiSecret,
        testnet: false,  // Default to production, can add toggle later
      });

      toast.success("Exchange connected successfully!");
      onConnectionSuccess?.();
      onOpenChange(false);
      
      // Clear form
      setApiKey("");
      setApiSecret("");
      setShowSecret(false);
      setValidationResult(null);
    } catch (error) {
      toast.error("Failed to save connection");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setApiKey("");
    setApiSecret("");
    setShowSecret(false);
    setValidationResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Connect Binance Exchange</DialogTitle>
          <DialogDescription>
            Connect your Binance account to enable live trading. Your API keys are encrypted and stored securely.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Instructions */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <div className="ml-2">
              <p className="text-sm font-medium">How to get your API keys:</p>
              <ol className="mt-2 text-sm space-y-1 list-decimal list-inside">
                <li>Log in to your Binance account</li>
                <li>Go to Profile → API Management</li>
                <li>Create a new API key with <strong>Spot Trading</strong> permissions</li>
                <li>Enable IP whitelist for additional security (optional but recommended)</li>
                <li>Copy the API Key and Secret Key here</li>
              </ol>
              <a 
                href="https://www.binance.com/en/support/faq/how-to-create-api-keys-on-binance-360002502072" 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center text-sm text-primary hover:underline"
              >
                View detailed instructions <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          </Alert>

          {/* API Key Input */}
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="text"
              placeholder="Enter your Binance API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isValidating}
            />
          </div>

          {/* API Secret Input */}
          <div className="space-y-2">
            <Label htmlFor="api-secret">API Secret</Label>
            <div className="relative">
              <Input
                id="api-secret"
                type={showSecret ? "text" : "password"}
                placeholder="Enter your Binance API Secret"
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                disabled={isValidating}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Validation Result */}
          {validationResult && (
            <Alert variant={validationResult.success ? "default" : "destructive"}>
              {validationResult.success ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <div className="ml-2">
                    <p className="text-sm font-medium">Connection validated successfully!</p>
                    <div className="mt-2 text-sm space-y-1">
                      <p><strong>Permissions:</strong> {validationResult.permissions?.join(", ")}</p>
                      {validationResult.balance && (
                        <p><strong>Account Status:</strong> Connected</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4" />
                  <div className="ml-2">
                    <p className="text-sm font-medium">Validation failed</p>
                    <p className="text-sm mt-1">{validationResult.error}</p>
                  </div>
                </>
              )}
            </Alert>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isValidating}>
            Cancel
          </Button>
          
          {!validationResult?.success ? (
            <Button onClick={handleValidateConnection} disabled={isValidating || !apiKey || !apiSecret}>
              {isValidating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>
          ) : (
            <Button onClick={handleSaveConnection}>
              Save & Connect
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

