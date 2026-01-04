// Exchange theme configurations
const EXCHANGE_THEMES = {
  binance: {
    primary: '#f0b90b',
    positive: '#0ecb81',
    negative: '#f6465d',
    background: '#1e2329',
    surface: '#2b3139',
    text: '#eaecef',
    textSecondary: '#848e9c',
  },
  bybit: {
    primary: '#f7a600',
    positive: '#20b26c',
    negative: '#ef454a',
    background: '#0b0e11',
    surface: '#1c1e22',
    text: '#ffffff',
    textSecondary: '#81858c',
  },
  okx: {
    primary: '#00c853',
    positive: '#00c853',
    negative: '#ff4d4f',
    background: '#121212',
    surface: '#1f1f1f',
    text: '#ffffff',
    textSecondary: '#8c8c8c',
  },
};

export function applyExchangeTheme(exchange) {
  const theme = EXCHANGE_THEMES[exchange] || EXCHANGE_THEMES.binance;

  const root = document.documentElement;
  root.style.setProperty('--lq-primary', theme.primary);
  root.style.setProperty('--lq-positive', theme.positive);
  root.style.setProperty('--lq-negative', theme.negative);
  root.style.setProperty('--lq-bg', theme.background);
  root.style.setProperty('--lq-surface', theme.surface);
  root.style.setProperty('--lq-text', theme.text);
  root.style.setProperty('--lq-text-secondary', theme.textSecondary);
}

export function getExchangeTheme(exchange) {
  return EXCHANGE_THEMES[exchange] || EXCHANGE_THEMES.binance;
}
