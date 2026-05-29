MARKET_ASSETS = [
    {'ticker': 'AAPL', 'name': 'Apple'},
    {'ticker': 'TSLA', 'name': 'Tesla'},
    {'ticker': 'AMZN', 'name': 'Amazon'},
    {'ticker': 'MSFT', 'name': 'Microsoft'},
    {'ticker': 'BINANCE:BTCUSDT', 'name': 'Bitcoin'},
    {'ticker': 'GOOGL', 'name': 'Alphabet'},
    {'ticker': 'NVD', 'name': 'Nvidia'},
]


def market_tickers():
    return [asset['ticker'] for asset in MARKET_ASSETS]
