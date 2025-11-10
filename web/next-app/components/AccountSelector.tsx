/* eslint-disable */
// @ts-nocheck
type AccountSelectorProps = {
  value: string;
  onChange: (value: string) => void;
  accounts: { key: string; label: string; description?: string }[];
};

export function AccountSelector({ value, onChange, accounts }: AccountSelectorProps) {
  return (
    <div className="flex flex-col gap-3">
      {accounts.map((account) => {
        const active = account.key === value;
        return (
          <button
            key={account.key}
            type="button"
            onClick={() => onChange(account.key)}
            className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition hover:border-primary ${
              active ? "border-primary bg-primary/5" : "border-border bg-background"
            }`}
          >
            <span className="font-medium">{account.label}</span>
            {account.description ? (
              <span className="text-xs text-muted-foreground">{account.description}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

