import os

import requests
from dotenv import load_dotenv
from firebase_admin import auth as firebase_auth

from services.Api_Handler import ApiHandler
from services.db_handler import DbHandler
from services.market_assets import MARKET_ASSETS

load_dotenv()

FIREBASE_WEB_API_KEY = os.getenv('FIREBASE_WEB_API_KEY', '').strip()


def resolver_email(email_o_usuario):
    valor = email_o_usuario.strip().lower()
    if '@' in valor:
        return valor
    return ''


def resolver_nombre_visible(email_o_usuario):
    valor = email_o_usuario.strip()
    if '@' in valor:
        return valor.split('@', 1)[0]
    return valor


def iniciar_sesion_firebase(email, password):
    if not FIREBASE_WEB_API_KEY:
        return False, 'Falta configurar FIREBASE_WEB_API_KEY en el entorno.'

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
        return True, response.json().get('localId')

    try:
        error_code = response.json().get('error', {}).get('message', '')
    except ValueError:
        error_code = ''

    errores = {
        'EMAIL_NOT_FOUND': 'No existe una cuenta con ese email.',
        'INVALID_PASSWORD': 'La contrasena no es correcta.',
        'USER_DISABLED': 'La cuenta esta deshabilitada.',
        'INVALID_LOGIN_CREDENTIALS': 'Las credenciales no son correctas.',
    }
    return False, errores.get(error_code, 'No se pudo iniciar sesion con Firebase Authentication.')


def mostrar_menu_login():
    print('\n' + '=' * 40)
    print('           ACCESO A SIMTRADE')
    print('=' * 40)
    print(' 1. Iniciar sesion')
    print(' 2. Registrarse')
    print(' 3. Salir')
    return input('\nSeleccione una opcion: ')


def iniciar_sesion(_db):
    username = input('Email: ').strip()
    password = input('Contrasena: ').strip()
    email = resolver_email(username)

    if not email:
        print('\nError: debes introducir un email valido.')
        return None

    ok, resultado = iniciar_sesion_firebase(email, password)
    if ok:
        print(f'\nBienvenido, {resolver_nombre_visible(username)}.')
        return resultado

    print(f'\nError: {resultado}')
    return None


def registrarse(db):
    username = input('Email de registro: ').strip()
    password = input('Elige una contrasena: ').strip()
    email = resolver_email(username)

    if not username or not password:
        print('\nError: email y contrasena son obligatorios.')
        return None

    if len(password) < 6:
        print('\nError: la contrasena debe tener al menos 6 caracteres.')
        return None

    if not email:
        print('\nError: para registrarte debes usar un email valido.')
        return None

    try:
        display_name = resolver_nombre_visible(username)
        user_record = firebase_auth.create_user(
            email=email,
            password=password,
            display_name=display_name,
        )
        db.crear_perfil_auth(user_record.uid, email, display_name)
        print(f'\nUsuario {display_name} creado correctamente.')
        return user_record.uid
    except ValueError as exc:
        print(f'\nError: {exc}')
        return None
    except Exception as exc:
        print(f'\nError: no se pudo crear el usuario en Firebase Authentication: {exc}')
        return None


def autenticar_usuario(db):
    while True:
        opcion = mostrar_menu_login()

        if opcion == '1':
            user_id = iniciar_sesion(db)
            if user_id:
                return user_id
        elif opcion == '2':
            user_id = registrarse(db)
            if user_id:
                return user_id
        elif opcion == '3':
            return None
        else:
            print('\nOpcion no valida.')


def mostrar_menu(saldo):
    print('\n' + '=' * 40)
    print(f'  SIMTRADE | SALDO DISPONIBLE: {saldo:.2f}$')
    print('=' * 40)
    print(' 1. Ver mercado e invertir')
    print(' 2. Ver mi cartera y vender')
    print(' 3. Consultar historial')
    print(' 4. Cerrar sesion')
    print(' 5. Salir')
    return input('\nSeleccione una opcion: ')


def obtener_precio_actual(market_api, ticker):
    tendencia = market_api.obtener_tendencia(ticker, '1d')

    if tendencia is None or not tendencia.get('points'):
        return None

    return float(tendencia['points'][-1]['price'])


def leer_float(mensaje):
    valor = input(mensaje).strip().replace(',', '.')
    return float(valor)


def mostrar_mercado(db, market_api, user_id):
    print('\n--- MERCADO DISPONIBLE ---')
    precios = {}

    for index, asset in enumerate(MARKET_ASSETS, start=1):
        ticker = asset['ticker']
        precio = obtener_precio_actual(market_api, ticker)

        if precio is None:
            print(f'{index}. {asset["name"]} ({ticker}): sin precio disponible')
            continue

        precios[index] = (ticker, asset['name'], precio)
        print(f'{index}. {asset["name"]} ({ticker}): {precio:.2f}$')

    try:
        seleccion = int(input('\nNumero de activo para comprar (0 para volver): '))
        if seleccion == 0:
            return

        if seleccion not in precios:
            print('\nOpcion no valida.')
            return

        ticker, nombre, precio = precios[seleccion]
        importe = leer_float(f'Cuanto dinero quieres invertir en {nombre}?: ')

        if importe <= 0:
            print('\nEl importe debe ser mayor que 0.')
            return

        cantidad = importe / precio
        exito, nuevo_saldo = db.realizar_compra(ticker, cantidad, precio, user_id)

        if exito:
            print(f'\nCompra realizada: {cantidad:.4f} unidades de {ticker}.')
            print(f'Nuevo saldo: {nuevo_saldo:.2f}$')
        else:
            print('\nError: saldo insuficiente.')
    except ValueError:
        print('\nEntrada no valida.')


def mostrar_cartera(db, market_api, user_id):
    user_data = db.obtener_usuario(user_id)
    cartera = user_data.get('cartera', {})

    print('\n' + '-' * 35)
    print('          TU CARTERA ACTUAL')
    print('-' * 35)

    if not cartera:
        print('No tienes activos todavia.')
        return

    opciones_venta = {}
    for index, (ticker, cantidad) in enumerate(cartera.items(), start=1):
        precio = obtener_precio_actual(market_api, ticker)
        valor = cantidad * precio if precio is not None else 0
        opciones_venta[index] = (ticker, cantidad, precio)
        precio_texto = f'{precio:.2f}$' if precio is not None else 'sin precio'
        print(f'{index}. {ticker:12} | Cant.: {cantidad:.4f} | Precio: {precio_texto} | Valor: {valor:.2f}$')

    try:
        seleccion = int(input('\nSeleccione activo para vender (0 para volver): '))
        if seleccion == 0:
            return

        if seleccion not in opciones_venta:
            print('\nOpcion no valida.')
            return

        ticker, cantidad_maxima, precio = opciones_venta[seleccion]
        if precio is None:
            print('\nNo hay precio disponible para vender este activo.')
            return

        print(f'\nGestion de {ticker} (Max: {cantidad_maxima:.4f} unidades)')
        print('1. Vender 25%')
        print('2. Vender 50%')
        print('3. Vender 100%')
        print('4. Introducir cantidad manual')
        sub_opcion = input('Seleccione opcion de venta: ')

        cantidad_vender = 0
        if sub_opcion == '1':
            cantidad_vender = cantidad_maxima * 0.25
        elif sub_opcion == '2':
            cantidad_vender = cantidad_maxima * 0.50
        elif sub_opcion == '3':
            cantidad_vender = cantidad_maxima
        elif sub_opcion == '4':
            cantidad_vender = leer_float(f'Cuantas unidades quieres vender? (Max {cantidad_maxima:.4f}): ')

        if cantidad_vender <= 0 or cantidad_vender > cantidad_maxima:
            print('\nCantidad no valida.')
            return

        exito, saldo_final = db.realizar_venta(ticker, cantidad_vender, precio, user_id)
        if exito:
            print(f'\nVenta completada. Has recibido {(cantidad_vender * precio):.2f}$.')
            print(f'Nuevo saldo total: {saldo_final:.2f}$')
        else:
            print('\nError en la venta.')
    except ValueError:
        print('\nEntrada no valida.')


def mostrar_historial(db, user_id):
    print('\n' + '=' * 55)
    print('              MI HISTORIAL DE OPERACIONES')
    print('=' * 55)

    movimientos = db.obtener_historial(user_id)

    if not movimientos:
        print('No hay movimientos registrados en tu cuenta.')
    else:
        for movimiento in movimientos:
            fecha = movimiento.get('fecha')
            fecha_texto = fecha.strftime('%d/%m/%Y %H:%M') if hasattr(fecha, 'strftime') else 'Pendiente...'
            tipo = str(movimiento.get('tipo', '')).upper()
            ticker = str(movimiento.get('ticker', '')).upper()
            cantidad = float(movimiento.get('cantidad', 0) or 0)
            total = float(movimiento.get('total_dinero', 0) or 0)
            print(f'[{fecha_texto}] {tipo:15} | {ticker:12} | Cant: {cantidad:.4f} | Total: {total:.2f}$')

    input('\nPresiona Enter para volver...')


def app_usuario():
    db = DbHandler(os.getenv('FIREBASE_JSON_PATH'))
    market_api = ApiHandler(os.getenv('FINNHUB_API_KEY'))

    while True:
        user_id = autenticar_usuario(db)

        if not user_id:
            print('\nSaliendo de Simtrade.')
            return

        while True:
            user_data = db.obtener_usuario(user_id)
            opcion = mostrar_menu(float(user_data.get('saldo', 1000.0) or 0))

            if opcion == '1':
                mostrar_mercado(db, market_api, user_id)
            elif opcion == '2':
                mostrar_cartera(db, market_api, user_id)
            elif opcion == '3':
                mostrar_historial(db, user_id)
            elif opcion == '4':
                print('\nSesion cerrada.')
                break
            elif opcion == '5':
                print('\nSaliendo de Simtrade.')
                return
            else:
                print('\nOpcion no valida.')


if __name__ == '__main__':
    app_usuario()
