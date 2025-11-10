import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Props = {
  params?: Record<string, number>;
  title?: string;
};

export function GenomeTraitTable({ params, title }: Props) {
  if (!params || Object.keys(params).length === 0) {
    return <p className="text-sm text-muted-foreground">No genome parameters available.</p>;
  }

  const entries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-3">
      {title && <h3 className="text-sm font-semibold">{title}</h3>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/2">Parameter</TableHead>
            <TableHead className="text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([key, value]) => (
            <TableRow key={key}>
              <TableCell className="font-medium">{key}</TableCell>
              <TableCell className="text-right">{typeof value === "number" ? value.toFixed(4) : String(value)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

