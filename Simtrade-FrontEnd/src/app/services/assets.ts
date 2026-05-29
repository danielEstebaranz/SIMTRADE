export interface MarketAsset {
  name: string;
  ticker: string;
}

export const MARKET_ASSETS: MarketAsset[] = [
  { ticker: 'AAPL', name: 'Apple' },
  { ticker: 'TSLA', name: 'Tesla' },
  { ticker: 'AMZN', name: 'Amazon' },
  { ticker: 'MSFT', name: 'Microsoft' },
  { ticker: 'BINANCE:BTCUSDT', name: 'Bitcoin' },
  { ticker: 'HINKF', name: 'HINKF' },
  { ticker: 'GOOGL', name: 'Alphabet' },
];

const assetNames = new Map(MARKET_ASSETS.map((asset) => [asset.ticker.toUpperCase(), asset.name]));

export function getAssetName(ticker: string): string {
  return assetNames.get(ticker.toUpperCase()) ?? ticker;
}
