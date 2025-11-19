import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipExplainer } from "@/components/TooltipExplainer";
import { SymbolDisplay } from "@/components/CryptoSelector";
import { useMode } from "@/lib/mode-context";
import { formatNumber } from "@/lib/utils";

type Order = {
  order_id: string;
  client_order_id?: string;
  symbol: string;
  side: string;
  type: string;
  status: string;
  quantity: number;
  filled_quantity?: number;
  price?: number;
  avg_fill_price?: number;
  mode: string;
  created_at?: string;
  updated_at?: string;
};

type OrderBlotterProps = {
  orders: Order[];
  onCancel?: (order: Order) => void;
  onSync?: (order: Order) => void;
  onAmend?: (order: Order) => void;
};

export function OrderBlotter({ orders, onCancel, onSync, onAmend }: OrderBlotterProps) {
  const { isEasyMode } = useMode();

  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Order Blotter</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6">
            <EmptyState
              variant="trading"
              title={isEasyMode ? "No Orders Yet" : "No Orders"}
              description={
                isEasyMode
                  ? "You haven't placed any orders yet. Use the trading interface to buy or sell cryptocurrency, or ask the assistant for recommendations."
                  : "No orders yet. Submit one using the Approval Wizard or Guided Trading Flow."
              }
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Order Blotter
          <TooltipExplainer 
            term="Order Blotter" 
            explanation="The order blotter is a real-time log of all your trading orders. It shows order status (new, filled, canceled), quantities, prices, and execution details. You can sync orders to check exchange status, amend prices/quantities for open orders, or cancel orders that haven't executed yet. Think of it as your order command center."
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Filled</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Avg Fill</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const remaining = Math.max(0, order.quantity - (order.filled_quantity ?? 0));
              const canCancel = ["new", "submitted", "partially_filled"].includes(order.status);

              return (
                <TableRow key={order.order_id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{order.order_id}</span>
                      <span className="text-xs text-muted-foreground">{order.client_order_id || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <SymbolDisplay symbol={order.symbol} />
                  </TableCell>
                  <TableCell className={order.side === "buy" ? "text-emerald-500" : "text-red-500"}>
                    {order.side.toUpperCase()}
                  </TableCell>
                  <TableCell>{order.type.toUpperCase()}</TableCell>
                  <TableCell className="capitalize">{order.status.replaceAll("_", " ")}</TableCell>
                  <TableCell>{formatNumber(order.quantity, 4)}</TableCell>
                  <TableCell>
                    {formatNumber(order.filled_quantity ?? 0, 4)}
                    {remaining ? (
                      <span className="ml-1 text-xs text-muted-foreground">({formatNumber(remaining, 4)} left)</span>
                    ) : null}
                  </TableCell>
                  <TableCell>{order.price ? `$${formatNumber(order.price, 2)}` : "—"}</TableCell>
                  <TableCell>{order.avg_fill_price ? `$${formatNumber(order.avg_fill_price, 2)}` : "—"}</TableCell>
                  <TableCell className="flex justify-end gap-2">
                    {onSync ? (
                      <Button variant="ghost" size="sm" onClick={() => onSync(order)}>
                        Sync
                      </Button>
                    ) : null}
                    {onAmend && canCancel ? (
                      <Button variant="ghost" size="sm" onClick={() => onAmend(order)}>
                        Amend
                      </Button>
                    ) : null}
                    {onCancel && canCancel ? (
                      <Button variant="destructive" size="sm" onClick={() => onCancel(order)}>
                        Cancel
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

