/* eslint-disable */
import { useState, useMemo } from "react";
import { Check, Search, X, ChevronDown, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Comprehensive mapping for top 100+ cryptocurrencies with CoinGecko logos
const CRYPTO_LOGOS: Record<string, string> = {
  // Top 10 by market cap
  'btc': 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  'eth': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  'bnb': 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  'sol': 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  'ada': 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
  'xrp': 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
  'dot': 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
  'doge': 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
  'avax': 'https://assets.coingecko.com/coins/images/12559/small/coin-round-red.png',
  'matic': 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',

  // Layer 1s and major altcoins
  'ltc': 'https://assets.coingecko.com/coins/images/2/small/litecoin.png',
  'trx': 'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png',
  'etc': 'https://assets.coingecko.com/coins/images/453/small/ethereum-classic-logo.png',
  'bch': 'https://assets.coingecko.com/coins/images/780/small/bitcoin-cash-circle.png',
  'neo': 'https://assets.coingecko.com/coins/images/480/small/NEO_512_512.png',
  'eos': 'https://assets.coingecko.com/coins/images/738/small/eos-eos-logo.png',
  'xlm': 'https://assets.coingecko.com/coins/images/100/small/Stellar_symbol_black_RGB.png',
  'zec': 'https://assets.coingecko.com/coins/images/486/small/circle-zcash-color.png',
  'dash': 'https://assets.coingecko.com/coins/images/19/small/dash-logo.png',
  'xmr': 'https://assets.coingecko.com/coins/images/69/small/monero_logo.png',

  // DeFi tokens
  'link': 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  'uni': 'https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png',
  'aave': 'https://assets.coingecko.com/coins/images/12645/small/AAVE.png',
  'comp': 'https://assets.coingecko.com/coins/images/10775/small/COMP.png',
  'yfi': 'https://assets.coingecko.com/coins/images/11849/small/yfi-192x192.png',
  'snx': 'https://assets.coingecko.com/coins/images/3406/small/SNX.png',
  'sushi': 'https://assets.coingecko.com/coins/images/12271/small/512x512_Logo_no_text.png',
  'cake': 'https://assets.coingecko.com/coins/images/12632/small/pancakeswap-cake-logo.png',
  'sxp': 'https://assets.coingecko.com/coins/images/9368/small/swipe.png',
  'bal': 'https://assets.coingecko.com/coins/images/11683/small/Balancer.png',

  // Stablecoins
  'usdc': 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
  'usdt': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  'dai': 'https://assets.coingecko.com/coins/images/9956/small/4943.png',
  'busd': 'https://assets.coingecko.com/coins/images/9576/small/BUSD.png',
  'ust': 'https://assets.coingecko.com/coins/images/12681/small/UST.png',
  'susd': 'https://assets.coingecko.com/coins/images/5013/small/sUSD.png',
  'frax': 'https://assets.coingecko.com/coins/images/13422/small/frax_logo.png',
  'lusd': 'https://assets.coingecko.com/coins/images/14666/small/Group_3.png',
  'tusd': 'https://assets.coingecko.com/coins/images/923/small/TrueUSD.png',
  'usdp': 'https://assets.coingecko.com/coins/images/13236/small/paxos-ust.png',

  // Layer 2s and scaling solutions
  'op': 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
  'arb': 'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
  'imx': 'https://assets.coingecko.com/coins/images/17233/small/immutableX-symbol-BLK-RGB.png',
  'lrc': 'https://assets.coingecko.com/coins/images/913/small/LRC.png',
  'celo': 'https://assets.coingecko.com/coins/images/11090/small/InjXBNx9_400x400.jpg',
  'ftm': 'https://assets.coingecko.com/coins/images/4001/small/Fantom_round.png',
  'one': 'https://assets.coingecko.com/coins/images/3912/small/Harmony_logo.png',

  // Popular altcoins
  'vet': 'https://assets.coingecko.com/coins/images/1167/small/VeChain-Logo-768x725.png',
  'icp': 'https://assets.coingecko.com/coins/images/14495/small/Internet_Computer_logo.png',
  'fil': 'https://assets.coingecko.com/coins/images/12817/small/filecoin.png',
  'hbar': 'https://assets.coingecko.com/coins/images/3688/small/hbar.png',
  'egld': 'https://assets.coingecko.com/coins/images/12335/small/Elrond.png',
  'theta': 'https://assets.coingecko.com/coins/images/2538/small/theta-token-logo.png',
  'mana': 'https://assets.coingecko.com/coins/images/878/small/decentraland-mana.png',
  'sand': 'https://assets.coingecko.com/coins/images/12129/small/sandbox_logo.jpg',
  'enj': 'https://assets.coingecko.com/coins/images/11041/small/enjin-coin-logo.png',
  'axs': 'https://assets.coingecko.com/coins/images/13029/small/axie_infinity_logo.png',

  // More DeFi and utility tokens
  'crv': 'https://assets.coingecko.com/coins/images/12124/small/Curve.png',
  '1inch': 'https://assets.coingecko.com/coins/images/13469/small/1inch-token.png',
  'ankr': 'https://assets.coingecko.com/coins/images/4324/small/U85xTl2.png',
  'chz': 'https://assets.coingecko.com/coins/images/8834/small/Chiliz.png',
  'bat': 'https://assets.coingecko.com/coins/images/677/small/basic-attention-token.png',
  'omg': 'https://assets.coingecko.com/coins/images/776/small/OMG_Network.jpg',
  'zrx': 'https://assets.coingecko.com/coins/images/863/small/0x.png',
  'rep': 'https://assets.coingecko.com/coins/images/309/small/augur-logo.png',
  'gnt': 'https://assets.coingecko.com/coins/images/1007/small/golem.png',
  'storj': 'https://assets.coingecko.com/coins/images/3499/small/enjin-coin-logo.png',

  // More popular coins
  'atom': 'https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png',
  'luna': 'https://assets.coingecko.com/coins/images/8284/small/01_Luna-Color.png',
  'near': 'https://assets.coingecko.com/coins/images/10365/small/near_icon.png',
  'flow': 'https://assets.coingecko.com/coins/images/13446/small/5f6294c0c7a8cda55cb1c936_Flow_Wordmark.png',
  'algo': 'https://assets.coingecko.com/coins/images/4380/small/download.png',
  'qnt': 'https://assets.coingecko.com/coins/images/3370/small/5ZOu7brX_400x400.jpg',
  'iotx': 'https://assets.coingecko.com/coins/images/3334/small/iotex-logo.png',
  'rune': 'https://assets.coingecko.com/coins/images/6595/small/Rune200x200.png',
  'klay': 'https://assets.coingecko.com/coins/images/9672/small/klaytn.png',
  'kava': 'https://assets.coingecko.com/coins/images/9761/small/kava.png',

  // Gaming and NFT tokens
  'gal': 'https://assets.coingecko.com/coins/images/24530/small/GALA_token_image_-_200PNG.png',
  'slp': 'https://assets.coingecko.com/coins/images/10366/small/SLP.png',
  'ilv': 'https://assets.coingecko.com/coins/images/14468/small/ILV.JPG',
  'ygg': 'https://assets.coingecko.com/coins/images/17358/small/le1BAeJ__400x400.jpg',
  'dar': 'https://assets.coingecko.com/coins/images/17880/small/Dar.png',
  'rndr': 'https://assets.coingecko.com/coins/images/11636/small/rndr.png',
  'hiv': 'https://assets.coingecko.com/coins/images/29845/small/hivemapper-avatar.png',
  'cfg': 'https://assets.coingecko.com/coins/images/18778/small/centr.png',

  // More tokens (reaching 100+)
  'ren': 'https://assets.coingecko.com/coins/images/10003/small/ren.png',
  'ocean': 'https://assets.coingecko.com/coins/images/3687/small/ocean-protocol-logo.jpg',
  'skl': 'https://assets.coingecko.com/coins/images/13245/small/SKALE_token_300x300.png',
  'coti': 'https://assets.coingecko.com/coins/images/2962/small/Coti.png',
  'powr': 'https://assets.coingecko.com/coins/images/1104/small/power-ledger.png',
  'tel': 'https://assets.coingecko.com/coins/images/11553/small/Tel.png',
  'ardr': 'https://assets.coingecko.com/coins/images/525/small/Ardor.png',
  'xem': 'https://assets.coingecko.com/coins/images/242/small/nem-logo.png',
  'btg': 'https://assets.coingecko.com/coins/images/1087/small/Bitcoin_Gold.png',
  'grin': 'https://assets.coingecko.com/coins/images/10031/small/Grin.png',
};

export function getCryptoLogo(symbol: string): string {
  const baseSymbol = symbol.split('/')[0].toLowerCase();
  return CRYPTO_LOGOS[baseSymbol] || `https://via.placeholder.com/24x24/gray/white?text=${baseSymbol.toUpperCase()}`;
}

interface CryptoSelectorProps {
  availableSymbols: string[];
  selectedSymbols: string[];
  onSelectionChange: (symbols: string[]) => void;
  placeholder?: string;
  className?: string;
  allowCustomSymbols?: boolean;
}

export function CryptoSelector({
  availableSymbols,
  selectedSymbols,
  onSelectionChange,
  placeholder = "Select cryptocurrencies...",
  className,
  allowCustomSymbols = true,
}: CryptoSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [customSymbols, setCustomSymbols] = useState<string[]>([]);
  const [newCustomSymbol, setNewCustomSymbol] = useState("");

  // Combine available symbols with custom symbols
  const allSymbols = useMemo(() => {
    const combined = [...availableSymbols];
    customSymbols.forEach(symbol => {
      if (!combined.includes(symbol)) {
        combined.push(symbol);
      }
    });
    return combined.sort();
  }, [availableSymbols, customSymbols]);

  const filteredSymbols = useMemo(() => {
    if (!searchQuery) return allSymbols;
    return allSymbols.filter(symbol =>
      symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      symbol.split('/')[0].toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allSymbols, searchQuery]);

  const handleAddCustomSymbol = () => {
    const trimmed = newCustomSymbol.trim().toUpperCase();
    if (!trimmed) return;

    // Add /USD suffix if not present
    const formatted = trimmed.includes("/") ? trimmed : `${trimmed}/USD`;

    // Check if already exists in available symbols or custom symbols
    if (!allSymbols.includes(formatted)) {
      setCustomSymbols([...customSymbols, formatted]);
    }
    setNewCustomSymbol("");
  };

  const handleToggleSymbol = (symbol: string) => {
    const isSelected = selectedSymbols.includes(symbol);
    if (isSelected) {
      onSelectionChange(selectedSymbols.filter(s => s !== symbol));
    } else {
      onSelectionChange([...selectedSymbols, symbol]);
    }
  };

  const handleRemoveSymbol = (symbol: string) => {
    onSelectionChange(selectedSymbols.filter(s => s !== symbol));
  };

  return (
    <div className={cn("space-y-3", className)}>
      <Label className="text-base font-semibold">Cryptocurrencies</Label>

      {/* Selected symbols as badges */}
      {selectedSymbols.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSymbols.map(symbol => {
            const isCustom = customSymbols.includes(symbol);
            return (
              <Badge key={symbol} variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5">
                <img
                  src={getCryptoLogo(symbol)}
                  alt={symbol}
                  className="w-4 h-4 rounded-full"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.src = `https://via.placeholder.com/24x24/gray/white?text=${symbol.split('/')[0]}`;
                  }}
                />
                <span className="flex items-center gap-1">
                  {symbol}
                  {isCustom && (
                    <span className="text-xs bg-muted text-muted-foreground px-1 rounded">
                      Custom
                    </span>
                  )}
                </span>
                <button
                  onClick={() => handleRemoveSymbol(symbol)}
                  className="ml-1 hover:text-destructive"
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Multi-select dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
          >
            <span className="truncate">
              {selectedSymbols.length === 0
                ? placeholder
                : `${selectedSymbols.length} selected`
              }
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md max-h-[80vh] overflow-hidden">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Select Cryptocurrencies</h3>
              <p className="text-sm text-muted-foreground">
                Choose the cryptocurrencies you want to track
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search cryptocurrencies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {allowCustomSymbols && (
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom symbol (e.g., SHIB, PEPE)"
                  value={newCustomSymbol}
                  onChange={(e) => setNewCustomSymbol(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomSymbol();
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddCustomSymbol}
                  variant="outline"
                  size="sm"
                  disabled={!newCustomSymbol.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="max-h-64 overflow-y-auto border rounded-md">
              {filteredSymbols.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No cryptocurrencies found
                </div>
              ) : (
                filteredSymbols.map(symbol => {
                  const isSelected = selectedSymbols.includes(symbol);
                  const isCustom = customSymbols.includes(symbol);
                  return (
                    <button
                      key={symbol}
                      onClick={() => handleToggleSymbol(symbol)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground border-b last:border-b-0",
                        isSelected && "bg-accent text-accent-foreground"
                      )}
                    >
                      <img
                        src={getCryptoLogo(symbol)}
                        alt={symbol}
                        className="w-6 h-6 rounded-full"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = `https://via.placeholder.com/24x24/gray/white?text=${symbol.split('/')[0]}`;
                        }}
                      />
                      <span className="flex-1 truncate">{symbol}</span>
                      {isCustom && (
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          Custom
                        </span>
                      )}
                      {isSelected && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {selectedSymbols.length} selected
              </span>
              <Button onClick={() => setIsOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Available count */}
      {(availableSymbols.length > 0 || customSymbols.length > 0) && (
        <div className="text-xs text-muted-foreground">
          {availableSymbols.length} predefined + {customSymbols.length} custom cryptocurrencies available
        </div>
      )}
    </div>
  );
}
