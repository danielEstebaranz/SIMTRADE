import os
import math

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from firebase_admin import auth as firebase_auth
from pydantic import BaseModel, Field
import requests
import uvicorn

from services.Api_Handler import ApiHandler
from services.db_handler import DbHandler
from services.market_assets import MARKET_ASSETS

load_dotenv()

HOST = os.getenv('SIMTRADE_API_HOST', '127.0.0.1')
PORT = int(os.getenv('SIMTRADE_API_PORT', '8000'))
FIREBASE_WEB_API_KEY = os.getenv('FIREBASE_WEB_API_KEY', '').strip()
INITIAL_BALANCE = 1000.0
MAX_FUNDS_DEPOSIT = 100000.0
ALLOWED_ORIGINS = [
    'http://127.0.0.1:4200',
    'http://localhost:4200',
]

app = FastAPI(
    title='Simtrade API',
    version='2.0.0',
    description='API REST preparada para Firebase Authentication.',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=['POST', 'GET', 'PATCH', 'DELETE'],
    allow_headers=['*'],
)

db = DbHandler(os.getenv('FIREBASE_JSON_PATH'))
market_api = ApiHandler(os.getenv('FINNHUB_API_KEY'))


class AuthRequest(BaseModel):
    username: str | None = None
    email: str | None = None
    password: str = Field(..., min_length=1, max_length=128)


class RegisterRequest(BaseModel):
    email: str | None = None
    username: str
    password: str = Field(..., min_length=6, max_length=128)


class BuyRequest(BaseModel):
    amount: float
    ticker: str


class SellRequest(BaseModel):
    percentage: float
    ticker: str


class SettingsRequest(BaseModel):
    theme: str


class AddFundsRequest(BaseModel):
    amount: float | str | None = None
    cantidad: float | str | None = None
    value: float | str | None = None


class BondInvestmentRequest(BaseModel):
    ticker: str
    amount: float | str


class ResetPortfolioRequest(BaseModel):
    confirmation: str
    password: str = Field(..., min_length=1, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)


def resolve_email(email, username):
    email_value = (email or '').strip().lower()
    username_value = username.strip()

    if email_value:
        return email_value

    if '@' in username_value:
        return username_value.lower()

    return ''


def resolve_display_name(username, email):
    username_value = username.strip()

    if username_value and '@' not in username_value:
        return username_value

    if email:
        return email.split('@', 1)[0]

    return username_value


def extract_bearer_token(authorization):
    if not authorization:
        raise HTTPException(status_code=401, detail='Falta cabecera Authorization.')

    if not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Authorization debe usar Bearer token.')

    return authorization.split(' ', 1)[1].strip()


def verify_current_user(authorization):
    id_token = extract_bearer_token(authorization)

    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        return decoded_token['uid']
    except Exception:
        raise HTTPException(status_code=401, detail='Token no valido o expirado.')


def public_user(user_id):
    return db.obtener_perfil_publico(user_id)


def normalize_theme(theme):
    theme_value = (theme or '').strip().lower()
    aliases = {
        'dark': 'dark',
        'oscuro': 'dark',
        'light': 'light',
        'claro': 'light',
    }

    if theme_value not in aliases:
        raise HTTPException(
            status_code=400,
            detail='El tema debe ser dark/light u oscuro/claro.',
        )

    return aliases[theme_value]


def normalize_funds_amount(amount):
    try:
        numeric_amount = float(amount)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail='La cantidad debe ser un numero valido.')

    if not math.isfinite(numeric_amount):
        raise HTTPException(status_code=400, detail='La cantidad debe ser un numero valido.')

    normalized_amount = round(numeric_amount, 2)

    if normalized_amount <= 0:
        raise HTTPException(status_code=400, detail='La cantidad debe ser mayor que 0.')

    if normalized_amount > MAX_FUNDS_DEPOSIT:
        raise HTTPException(
            status_code=400,
            detail=f'La cantidad maxima por ingreso es {MAX_FUNDS_DEPOSIT:.2f}.',
        )

    return normalized_amount


def resolve_payload_amount(payload):
    amount = payload.amount

    if amount is None:
        amount = payload.cantidad

    if amount is None:
        amount = payload.value

    if amount is None:
        raise HTTPException(status_code=400, detail='La cantidad es obligatoria.')

    return normalize_funds_amount(amount)


def firebase_sign_in(email, password):
    if not FIREBASE_WEB_API_KEY:
        raise HTTPException(
            status_code=500,
            detail='Falta configurar FIREBASE_WEB_API_KEY en el entorno.',
        )

    response = requests.post(
        f'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_WEB_API_KEY}',
        json={
            'email': email,
            'password': password,
            'returnSecureToken': True,
        },
        timeout=30,
    )

    if response.status_code == 200:
        return response.json()

    try:
        error_code = response.json().get('error', {}).get('message', '')
    except ValueError:
        error_code = ''

    errores = {
        'EMAIL_NOT_FOUND': 'No existe una cuenta con ese email.',
        'INVALID_PASSWORD': 'La contraseña no es correcta.',
        'USER_DISABLED': 'La cuenta esta deshabilitada.',
        'INVALID_LOGIN_CREDENTIALS': 'Las credenciales no son correctas.',
    }
    raise HTTPException(
        status_code=401,
        detail=errores.get(error_code, 'No se pudo iniciar sesion con Firebase Authentication.'),
    )


@app.get('/')
def healthcheck():
    return {'message': 'Simtrade API activa.'}


@app.get('/auth/me')
def get_current_user_profile(authorization: str | None = Header(default=None)):
    user_id = verify_current_user(authorization)
    return {
        'message': 'Usuario autenticado.',
        'user': public_user(user_id),
    }


@app.get('/users/me/portfolio')
def get_my_portfolio(authorization: str | None = Header(default=None)):
    user_id = verify_current_user(authorization)
    posiciones = db.obtener_cartera(user_id)

    return {
        'user': public_user(user_id),
        'portfolio': posiciones,
        'total_activos': len(posiciones),
    }


@app.get('/users/me/history')
def get_my_history(authorization: str | None = Header(default=None)):
    user_id = verify_current_user(authorization)
    transacciones = [
        transaccion
        for transaccion in db.obtener_historial(user_id)
        if str(transaccion.get('tipo', '')).upper() != 'DIVIDENDO_REINVERTIDO'
    ]

    return {
        'items': [public_transaction(transaccion) for transaccion in transacciones],
    }


@app.get('/users/me/settings')
def get_my_settings(authorization: str | None = Header(default=None)):
    user_id = verify_current_user(authorization)

    return {
        'settings': db.obtener_configuracion(user_id),
        'user': public_user(user_id),
    }


@app.patch('/users/me/settings')
def update_my_settings(payload: SettingsRequest, authorization: str | None = Header(default=None)):
    user_id = verify_current_user(authorization)
    theme = normalize_theme(payload.theme)
    settings = db.actualizar_tema(user_id, theme)

    return {
        'message': 'Configuracion actualizada correctamente.',
        'settings': settings,
        'user': public_user(user_id),
    }


@app.post('/users/me/funds')
def add_my_funds(payload: AddFundsRequest, authorization: str | None = Header(default=None)):
    user_id = verify_current_user(authorization)
    amount = resolve_payload_amount(payload)
    balance = db.anadir_fondos(user_id, amount)

    return {
        'message': 'Fondos añadidos correctamente.',
        'operation': {
            'amount': amount,
            'balance': balance,
        },
        'user': public_user(user_id),
    }


@app.post('/users/me/funds/withdraw')
def withdraw_my_funds(payload: AddFundsRequest, authorization: str | None = Header(default=None)):
    user_id = verify_current_user(authorization)
    amount = resolve_payload_amount(payload)
    success, balance = db.retirar_fondos(user_id, amount)

    if not success:
        raise HTTPException(status_code=400, detail='No tienes saldo suficiente para retirar esa cantidad.')

    return {
        'message': 'Fondos retirados correctamente.',
        'operation': {
            'amount': amount,
            'balance': balance,
        },
        'user': public_user(user_id),
    }


def verify_account_password(user_id, password, action='continuar'):
    user = public_user(user_id)
    email = user.get('email') or user.get('username')
    clean_password = password.strip()

    if not email or '@' not in email:
        raise HTTPException(status_code=400, detail='No se encontro un email valido para verificar la cuenta.')

    if not clean_password:
        raise HTTPException(status_code=400, detail=f'La contraseña es obligatoria para {action}.')

    firebase_session = firebase_sign_in(email, clean_password)

    if firebase_session.get('localId') != user_id:
        raise HTTPException(status_code=401, detail='La contraseña no corresponde a esta cuenta.')


def verify_delete_password(user_id, password):
    verify_account_password(user_id, password, 'borrar la cuenta')


def delete_verified_account(user_id):
    try:
        firebase_auth.delete_user(user_id)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f'No se pudo borrar la cuenta en Firebase Authentication: {exc}',
        )

    delete_result = db.eliminar_cuenta(user_id)

    return {
        'message': 'Cuenta borrada correctamente.',
        **delete_result,
    }


@app.get('/bonds/offers')
def get_bond_offers():
    return {
        'items': db.obtener_ofertas_bonos(),
    }


@app.get('/users/me/bonds')
def get_my_bonds(authorization: str | None = Header(default=None)):
    user_id = verify_current_user(authorization)
    bonds = db.obtener_bonos_usuario(user_id, liquidar_vencidos=True)

    return {
        'items': bonds,
        'active': [bond for bond in bonds if bond.get('status') == 'active'],
        'settled': [bond for bond in bonds if bond.get('status') == 'settled'],
        'user': public_user(user_id),
    }


@app.post('/users/me/bonds')
def create_my_bond(payload: BondInvestmentRequest, authorization: str | None = Header(default=None)):
    user_id = verify_current_user(authorization)
    ticker = payload.ticker.strip().upper()
    amount = normalize_funds_amount(payload.amount)

    if not ticker:
        raise HTTPException(status_code=400, detail='El ticker del bono es obligatorio.')

    success, result, bond = db.crear_bono(user_id, ticker, amount)

    if not success and result == 'BOND_NOT_FOUND':
        raise HTTPException(status_code=404, detail='No existe una oferta de bono para ese activo.')

    if not success and result == 'INSUFFICIENT_FUNDS':
        raise HTTPException(status_code=400, detail='Saldo insuficiente para invertir en ese bono.')

    return {
        'message': 'Bono contratado correctamente.',
        'bond': bond,
        'operation': {
            'amount': amount,
            'balance': result,
        },
        'user': public_user(user_id),
    }


@app.post('/users/me/bonds/settle')
def settle_my_bonds(authorization: str | None = Header(default=None)):
    user_id = verify_current_user(authorization)
    settled = db.liquidar_bonos_vencidos(user_id)

    return {
        'message': 'Bonos vencidos liquidados correctamente.',
        'items': settled,
        'settledCount': len(settled),
        'user': public_user(user_id),
    }


@app.post('/users/me/portfolio/reset')
def reset_my_portfolio(payload: ResetPortfolioRequest, authorization: str | None = Header(default=None)):
    user_id = verify_current_user(authorization)

    if payload.confirmation.strip() != 'REINICIAR':
        raise HTTPException(status_code=400, detail='Escribe REINICIAR en mayusculas para confirmar.')

    verify_account_password(user_id, payload.password, 'reiniciar la cartera')
    balance = db.reiniciar_cartera(user_id, INITIAL_BALANCE)

    return {
        'message': 'Cartera reiniciada correctamente.',
        'operation': {
            'balance': balance,
        },
        'user': public_user(user_id),
    }


@app.post('/users/me/delete')
def delete_my_account_with_password(payload: DeleteAccountRequest, authorization: str | None = Header(default=None)):
    user_id = verify_current_user(authorization)
    verify_delete_password(user_id, payload.password)

    return delete_verified_account(user_id)


@app.delete('/users/me')
def delete_my_account(payload: DeleteAccountRequest, authorization: str | None = Header(default=None)):
    user_id = verify_current_user(authorization)
    verify_delete_password(user_id, payload.password)

    return delete_verified_account(user_id)


@app.get('/users/me/portfolio/gains')
def get_my_portfolio_gains(authorization: str | None = Header(default=None)):
    user_id = verify_current_user(authorization)
    user = public_user(user_id)
    cartera = user.get('cartera', {})
    transacciones = db.obtener_transacciones_usuario(user_id)
    costes = calcular_costes_abiertos(transacciones)
    resumen = {
        'costBasisSource': 'none',
        'dailyGain': 0.0,
        'hasCostBasis': False,
        'investedCost': 0.0,
        'positions': {},
        'source': 'yfinance',
        'totalGain': 0.0,
        'totalValue': 0.0,
    }

    for ticker, cantidad in cartera.items():
        if cantidad <= 0:
            continue

        tendencia = market_api.obtener_tendencia(ticker, '1d')
        if tendencia is None or not tendencia.get('points'):
            continue

        puntos = tendencia['points']
        primer_precio = puntos[0]['price']
        ultimo_precio = puntos[-1]['price']
        valor_actual = cantidad * ultimo_precio
        coste_abierto = costes.get(ticker.upper())

        resumen['totalValue'] += valor_actual
        resumen['dailyGain'] += cantidad * (ultimo_precio - primer_precio)
        resumen['positions'][ticker.upper()] = {
            'costBasisSource': 'none',
            'dailyGain': cantidad * (ultimo_precio - primer_precio),
            'hasCostBasis': False,
            'investedCost': 0.0,
            'totalGain': 0.0,
            'totalValue': valor_actual,
        }

        if coste_abierto is not None:
            resumen['hasCostBasis'] = True
            resumen['costBasisSource'] = 'history'
            resumen['investedCost'] += coste_abierto
            resumen['totalGain'] += valor_actual - coste_abierto
            resumen['positions'][ticker.upper()].update({
                'costBasisSource': 'history',
                'hasCostBasis': True,
                'investedCost': coste_abierto,
                'totalGain': valor_actual - coste_abierto,
            })

    if not resumen['hasCostBasis'] and resumen['totalValue'] > 0:
        saldo_actual = float(user.get('saldo', INITIAL_BALANCE) or 0)
        saldo_base = INITIAL_BALANCE + calcular_fondos_anadidos(transacciones)
        coste_estimado = max(0.0, saldo_base - saldo_actual)
        resumen['hasCostBasis'] = coste_estimado > 0
        resumen['costBasisSource'] = 'balance_estimate' if coste_estimado > 0 else 'none'
        resumen['investedCost'] = coste_estimado
        resumen['totalGain'] = resumen['totalValue'] - coste_estimado if coste_estimado > 0 else 0.0

        for position in resumen['positions'].values():
            peso = position['totalValue'] / resumen['totalValue']
            coste_posicion = coste_estimado * peso
            position['hasCostBasis'] = coste_posicion > 0
            position['costBasisSource'] = 'balance_estimate' if coste_posicion > 0 else 'none'
            position['investedCost'] = coste_posicion
            position['totalGain'] = position['totalValue'] - coste_posicion if coste_posicion > 0 else 0.0

    return resumen


@app.post('/users/me/portfolio/buy')
def buy_asset(payload: BuyRequest, authorization: str | None = Header(default=None)):
    user_id = verify_current_user(authorization)
    ticker = payload.ticker.strip().upper()
    amount = payload.amount

    if not ticker:
        raise HTTPException(status_code=400, detail='El ticker es obligatorio.')

    if amount <= 0:
        raise HTTPException(status_code=400, detail='El importe debe ser mayor que 0.')

    tendencia = market_api.obtener_tendencia(ticker, '1d')
    if tendencia is None or not tendencia.get('points'):
        raise HTTPException(status_code=404, detail='No hay precio real disponible para ese activo.')

    price = tendencia['points'][-1]['price']
    quantity = amount / price
    success, balance = db.realizar_compra(ticker, quantity, price, user_id)

    if not success:
        raise HTTPException(status_code=400, detail='Saldo insuficiente para realizar la compra.')

    return {
        'message': 'Compra realizada correctamente.',
        'operation': {
            'ticker': ticker,
            'quantity': quantity,
            'price': price,
            'total': amount,
            'balance': balance,
        },
        'user': public_user(user_id),
    }


@app.post('/users/me/portfolio/sell')
def sell_asset(payload: SellRequest, authorization: str | None = Header(default=None)):
    user_id = verify_current_user(authorization)
    ticker = payload.ticker.strip().upper()
    percentage = payload.percentage

    if not ticker:
        raise HTTPException(status_code=400, detail='El ticker es obligatorio.')

    if percentage <= 0 or percentage > 100:
        raise HTTPException(status_code=400, detail='El porcentaje debe estar entre 0 y 100.')

    user = public_user(user_id)
    cartera = user.get('cartera', {})
    current_quantity = float(cartera.get(ticker, 0) or 0)

    if current_quantity <= 0:
        raise HTTPException(status_code=400, detail='No tienes unidades de ese activo para vender.')

    tendencia = market_api.obtener_tendencia(ticker, '1d')
    if tendencia is None or not tendencia.get('points'):
        raise HTTPException(status_code=404, detail='No hay precio real disponible para ese activo.')

    price = tendencia['points'][-1]['price']
    quantity = current_quantity * (percentage / 100)
    success, balance = db.realizar_venta(ticker, quantity, price, user_id)

    if not success:
        raise HTTPException(status_code=400, detail='No se pudo realizar la venta.')

    return {
        'message': 'Venta realizada correctamente.',
        'operation': {
            'ticker': ticker,
            'quantity': quantity,
            'percentage': percentage,
            'price': price,
            'total': quantity * price,
            'balance': balance,
        },
        'user': public_user(user_id),
    }


@app.get('/market/{ticker}/trend')
def get_market_trend(ticker: str, range: str = Query('1d')):
    if range not in {'1d', '1w', '1y'}:
        raise HTTPException(status_code=400, detail='El rango debe ser 1d, 1w o 1y.')

    tendencia = market_api.obtener_tendencia(ticker, range)
    if tendencia is None or not tendencia.get('points'):
        raise HTTPException(status_code=404, detail='No hay datos de tendencia para ese activo.')

    return tendencia


@app.get('/market/assets')
def get_market_assets():
    return {
        'items': MARKET_ASSETS,
    }


@app.get('/market/statistics')
def get_market_statistics():
    ranges = {
        'daily': '1d',
        'weekly': '1w',
    }
    statistics = {}

    for label, trend_range in ranges.items():
        items = []

        for asset in MARKET_ASSETS:
            tendencia = market_api.obtener_tendencia(asset['ticker'], trend_range)
            puntos = tendencia.get('points', []) if tendencia else []

            if len(puntos) < 2:
                continue

            first = float(puntos[0]['price'])
            last = float(puntos[-1]['price'])
            change = last - first
            change_percent = 0.0 if first == 0 else (change / first) * 100
            items.append({
                'ticker': asset['ticker'],
                'name': asset['name'],
                'change': change,
                'changePercent': change_percent,
                'lastPrice': last,
            })

        ordered = sorted(items, key=lambda item: item['changePercent'], reverse=True)
        statistics[label] = {
            'best': ordered[0] if ordered else None,
            'worst': ordered[-1] if ordered else None,
            'items': ordered,
        }

    return {
        'source': 'yfinance',
        **statistics,
    }


def calcular_costes_abiertos(transacciones):
    costes = {}
    cantidades = {}

    for transaccion in transacciones:
        ticker = str(transaccion.get('ticker', '')).upper()
        tipo = str(transaccion.get('tipo', '')).upper()
        cantidad = float(transaccion.get('cantidad', 0) or 0)
        precio = float(transaccion.get('precio_unidad', 0) or 0)

        if not ticker or cantidad <= 0:
            continue

        if tipo in {'COMPRA', 'DIVIDENDO_REINVERTIDO'}:
            cantidades[ticker] = cantidades.get(ticker, 0.0) + cantidad
            costes[ticker] = costes.get(ticker, 0.0) + cantidad * precio
            continue

        if tipo == 'REINICIO':
            cantidades = {}
            costes = {}
            continue

        if tipo == 'VENTA':
            cantidad_actual = cantidades.get(ticker, 0.0)
            coste_actual = costes.get(ticker, 0.0)

            if cantidad_actual <= 0:
                continue

            coste_medio = coste_actual / cantidad_actual
            cantidad_vendida = min(cantidad, cantidad_actual)
            cantidades[ticker] = cantidad_actual - cantidad_vendida
            costes[ticker] = max(0.0, coste_actual - cantidad_vendida * coste_medio)

    return {
        ticker: coste
        for ticker, coste in costes.items()
        if cantidades.get(ticker, 0.0) > 0 and coste > 0
    }


def calcular_fondos_anadidos(transacciones):
    total = 0.0

    for transaccion in transacciones:
        tipo = str(transaccion.get('tipo', '')).upper()

        if tipo == 'DEPOSITO':
            total += float(transaccion.get('total_dinero', 0) or 0)
            continue

        if tipo == 'RETIRADA':
            total -= float(transaccion.get('total_dinero', 0) or 0)
            continue

        if tipo == 'BONO_INVERSION':
            total -= float(transaccion.get('total_dinero', 0) or 0)
            continue

        if tipo == 'BONO_CIERRE':
            total += float(transaccion.get('total_dinero', 0) or 0)
            continue

        if tipo == 'REINICIO':
            total = 0.0

    return total


def public_transaction(transaccion):
    fecha = transaccion.get('fecha')

    return {
        'id': transaccion.get('id', ''),
        'type': str(transaccion.get('tipo', '')).lower(),
        'ticker': str(transaccion.get('ticker', '')).upper(),
        'quantity': float(transaccion.get('cantidad', 0) or 0),
        'price': float(transaccion.get('precio_unidad', 0) or 0),
        'total': float(transaccion.get('total_dinero', 0) or 0),
        'date': fecha.isoformat() if hasattr(fecha, 'isoformat') else None,
    }


@app.post('/auth/login')
def login_help(payload: AuthRequest):
    identificador = (payload.email or payload.username or '').strip()
    password = payload.password.strip()

    if not identificador or not password:
        raise HTTPException(status_code=400, detail='Usuario/email y contraseña son obligatorios.')

    email = resolve_email(payload.email, identificador)
    if not email:
        raise HTTPException(status_code=400, detail='Debes usar un email valido para iniciar sesion.')

    firebase_session = firebase_sign_in(email, password)
    user_id = firebase_session.get('localId')

    return {
        'message': 'Inicio de sesion correcto.',
        'user': public_user(user_id),
        'idToken': firebase_session.get('idToken'),
        'refreshToken': firebase_session.get('refreshToken'),
    }


@app.post('/auth/register', status_code=201)
def register(payload: RegisterRequest):
    username = payload.username.strip()
    email = resolve_email(payload.email, username)
    display_name = resolve_display_name(username, email)
    password = payload.password.strip()

    if not username or not password:
        raise HTTPException(
            status_code=400,
            detail='Usuario y contraseña son obligatorios.',
        )

    if not email:
        raise HTTPException(
            status_code=400,
            detail='Debes indicar un email valido para registrar el usuario.',
        )

    try:
        user_record = firebase_auth.create_user(
            email=email,
            password=password,
            display_name=display_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=409,
            detail=f'No se pudo crear el usuario en Firebase Auth: {exc}',
        )

    db.crear_perfil_auth(user_record.uid, email, display_name)
    firebase_session = firebase_sign_in(email, password)

    return {
        'message': 'Usuario creado correctamente en Firebase Authentication.',
        'user': public_user(user_record.uid),
        'idToken': firebase_session.get('idToken'),
        'refreshToken': firebase_session.get('refreshToken'),
    }


if __name__ == '__main__':
    uvicorn.run(app, host=HOST, port=PORT, reload=False)
