import firebase_admin
import math
from datetime import datetime, timedelta, timezone
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter


DEFAULT_SETTINGS = {
    'theme': 'light',
}

BOND_OFFERS = {
    'AMZN': {
        'name': 'Amazon',
        'return_percent': 2.0,
        'duration_seconds': 60,
    },
    'AAPL': {
        'name': 'Apple',
        'return_percent': 1.5,
        'duration_seconds': 60,
    },
    'MSFT': {
        'name': 'Microsoft',
        'return_percent': 1.6,
        'duration_seconds': 60,
    },
    'GOOGL': {
        'name': 'Alphabet',
        'return_percent': 1.8,
        'duration_seconds': 60,
    },
    'TSLA': {
        'name': 'Tesla',
        'return_percent': 2.5,
        'duration_seconds': 60,
    },
}


class DbHandler:
    def __init__(self, certificado_path):
        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate(certificado_path)
                firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            print("Conexión establecida con Firebase Firestore.")
        except Exception as exc:
            print(f"Error crítico al conectar con Firebase: {exc}")
    
    def actualizar_precio(self, datos):
        """Actualiza los precios en la colección 'mercado'"""
        try:
            doc_ref = self.db.collection('mercado').document(datos['simbolo'])
            doc_ref.set({
                'precio_actual': datos['precio'],
                'cambio': datos['variacion'],
                'porcentaje': datos['porcentaje'],
                'ultima_actualizacion': firestore.SERVER_TIMESTAMP 
            })
        except Exception as exc:
            print(f"Error al actualizar precio: {exc}")

    def crear_perfil_auth(self, uid, email, username):
        """Crea o actualiza el perfil de un usuario autenticado con Firebase Auth."""
        user_ref = self.db.collection('usuarios').document(uid)
        doc = user_ref.get()
        datos_perfil = {
            'username': username.strip(),
            'email': email.strip().lower(),
            'auth_provider': 'firebase_auth',
        }

        if doc.exists:
            user_ref.set(datos_perfil, merge=True)
        else:
            user_ref.set({
                **datos_perfil,
                'saldo': 1000.0,
                'cartera': {},
                'settings': DEFAULT_SETTINGS.copy(),
                'fecha_creacion': firestore.SERVER_TIMESTAMP,
            })

        return self.obtener_usuario(uid)

    def obtener_usuario(self, user_id="usuario_demo"):
        user_ref = self.db.collection('usuarios').document(user_id)
        doc = user_ref.get()
        if doc.exists:
            datos_usuario = doc.to_dict()
            if 'saldo' not in datos_usuario:
                datos_usuario['saldo'] = 1000.0
            if 'cartera' not in datos_usuario:
                datos_usuario['cartera'] = {}
            datos_usuario['settings'] = self._normalizar_settings(datos_usuario)
            return datos_usuario
        else:
            datos_iniciales = {
                'username': user_id,
                'saldo': 1000.0,
                'cartera': {},
                'settings': DEFAULT_SETTINGS.copy(),
            }
            user_ref.set(datos_iniciales)
            return datos_iniciales

    def _normalizar_settings(self, user_data):
        """Devuelve la configuracion publica con valores seguros por defecto."""
        settings = user_data.get('settings') or {}
        theme = str(settings.get('theme', DEFAULT_SETTINGS['theme'])).strip().lower()

        if theme not in {'dark', 'light'}:
            theme = DEFAULT_SETTINGS['theme']

        return {
            'theme': theme,
        }

    def obtener_cartera(self, user_id):
        """Devuelve la cartera del usuario como lista simple de posiciones."""
        user_data = self.obtener_usuario(user_id)
        cartera = user_data.get('cartera', {})

        return [
            {
                'ticker': ticker,
                'cantidad': cantidad,
            }
            for ticker, cantidad in cartera.items()
        ]

    def obtener_perfil_publico(self, user_id):
        """Devuelve un perfil seguro para la API, sin datos sensibles."""
        user_data = self.obtener_usuario(user_id)
        return {
            'id': user_id,
            'username': user_data.get('username', user_id),
            'email': user_data.get('email', ''),
            'saldo': user_data.get('saldo', 1000.0),
            'cartera': user_data.get('cartera', {}),
            'settings': self._normalizar_settings(user_data),
        }

    def obtener_configuracion(self, user_id):
        """Lee las preferencias de configuracion del usuario."""
        user_data = self.obtener_usuario(user_id)
        return self._normalizar_settings(user_data)

    def actualizar_tema(self, user_id, theme):
        """Actualiza el modo visual elegido por el usuario."""
        user_ref = self.db.collection('usuarios').document(user_id)
        self.obtener_usuario(user_id)
        settings = {
            **DEFAULT_SETTINGS,
            'theme': theme,
        }
        user_ref.update({'settings': settings})
        return settings

    def _registrar_transaccion(self, user_id, tipo, ticker, cantidad, precio, total):
        """Guarda un registro de la operación en la colección 'transacciones'."""
        try:
            trans_ref = self.db.collection('transacciones').document()
            trans_ref.set({
                'usuario': user_id,
                'tipo': tipo,
                'ticker': ticker,
                'cantidad': cantidad,
                'precio_unidad': precio,
                'total_dinero': total,
                'fecha': firestore.SERVER_TIMESTAMP
            })
        except Exception as exc:
            print(f"Error al escribir en historial: {exc}")

    def anadir_fondos(self, user_id, cantidad):
        """Suma fondos al saldo disponible del usuario y registra el movimiento."""
        user_ref = self.db.collection('usuarios').document(user_id)
        user_data = self.obtener_usuario(user_id)
        saldo_actual = float(user_data.get('saldo', 1000.0) or 0)
        nuevo_saldo = round(saldo_actual + cantidad, 2)
        user_ref.update({'saldo': nuevo_saldo})
        self._registrar_transaccion(user_id, 'DEPOSITO', 'CASH', 1, cantidad, cantidad)
        return nuevo_saldo

    def retirar_fondos(self, user_id, cantidad):
        """Resta fondos del saldo disponible del usuario y registra el movimiento."""
        user_ref = self.db.collection('usuarios').document(user_id)
        user_data = self.obtener_usuario(user_id)
        saldo_actual = float(user_data.get('saldo', 1000.0) or 0)

        if cantidad > saldo_actual:
            return False, saldo_actual

        nuevo_saldo = round(saldo_actual - cantidad, 2)
        user_ref.update({'saldo': nuevo_saldo})
        self._registrar_transaccion(user_id, 'RETIRADA', 'CASH', 1, cantidad, cantidad)
        return True, nuevo_saldo

    def obtener_ofertas_bonos(self):
        """Devuelve las ofertas de bonos disponibles para invertir."""
        return [
            {
                'ticker': ticker,
                **offer,
            }
            for ticker, offer in BOND_OFFERS.items()
        ]

    def crear_bono(self, user_id, ticker, cantidad):
        """Crea una inversion en bono y descuenta el importe del saldo."""
        ticker = ticker.strip().upper()
        offer = BOND_OFFERS.get(ticker)

        if offer is None:
            return False, 'BOND_NOT_FOUND', None

        user_ref = self.db.collection('usuarios').document(user_id)
        user_data = self.obtener_usuario(user_id)
        saldo_actual = float(user_data.get('saldo', 1000.0) or 0)

        if cantidad > saldo_actual:
            return False, 'INSUFFICIENT_FUNDS', saldo_actual

        started_at = datetime.now(timezone.utc)
        maturity_at = started_at + timedelta(seconds=offer['duration_seconds'])
        nuevo_saldo = round(saldo_actual - cantidad, 2)
        user_ref.update({'saldo': nuevo_saldo})

        bond_ref = self.db.collection('bonos').document()
        bond_ref.set({
            'usuario': user_id,
            'ticker': ticker,
            'name': offer['name'],
            'amount': cantidad,
            'return_percent': offer['return_percent'],
            'profit': round(cantidad * (offer['return_percent'] / 100), 2),
            'payout': round(cantidad + cantidad * (offer['return_percent'] / 100), 2),
            'duration_seconds': offer['duration_seconds'],
            'status': 'active',
            'started_at': started_at,
            'maturity_at': maturity_at,
            'settled_at': None,
        })
        self._registrar_transaccion(user_id, 'BONO_INVERSION', ticker, 1, cantidad, cantidad)

        bono = bond_ref.get().to_dict()
        bono['id'] = bond_ref.id
        return True, nuevo_saldo, self._public_bond(bono)

    def obtener_bonos_usuario(self, user_id, liquidar_vencidos=True):
        """Consulta los bonos del usuario y liquida los vencidos si se solicita."""
        if liquidar_vencidos:
            self.liquidar_bonos_vencidos(user_id)

        try:
            docs = self.db.collection('bonos')\
                        .where(filter=FieldFilter('usuario', '==', user_id))\
                        .get()
            bonos = []

            for doc in docs:
                bono = doc.to_dict()
                bono['id'] = doc.id
                bonos.append(self._public_bond(bono))

            return sorted(
                bonos,
                key=lambda bono: bono.get('startedAt') or '',
                reverse=True,
            )
        except Exception as exc:
            print(f"Error al consultar bonos: {exc}")
            return []

    def liquidar_bonos_vencidos(self, user_id):
        """Liquida bonos activos cuya fecha de vencimiento ya se haya cumplido."""
        now = datetime.now(timezone.utc)
        try:
            docs = self.db.collection('bonos')\
                        .where(filter=FieldFilter('usuario', '==', user_id))\
                        .get()
            liquidados = []

            for doc in docs:
                bono = doc.to_dict()

                if bono.get('status') != 'active':
                    continue

                maturity_at = bono.get('maturity_at')
                maturity_at = self._ensure_utc(maturity_at)

                if not maturity_at or maturity_at > now:
                    continue

                payout = round(float(bono.get('payout', 0) or 0), 2)
                profit = round(float(bono.get('profit', 0) or 0), 2)
                ticker = str(bono.get('ticker', '')).upper()
                user_ref = self.db.collection('usuarios').document(user_id)
                user_data = self.obtener_usuario(user_id)
                saldo_actual = float(user_data.get('saldo', 1000.0) or 0)
                nuevo_saldo = round(saldo_actual + payout, 2)
                user_ref.update({'saldo': nuevo_saldo})
                doc.reference.update({
                    'status': 'settled',
                    'settled_at': now,
                    'balance_after_settlement': nuevo_saldo,
                })
                self._registrar_transaccion(user_id, 'BONO_CIERRE', ticker, 1, payout, payout)

                bono.update({
                    'id': doc.id,
                    'status': 'settled',
                    'settled_at': now,
                    'balance_after_settlement': nuevo_saldo,
                    'profit': profit,
                    'payout': payout,
                })
                liquidados.append(self._public_bond(bono))

            return liquidados
        except Exception as exc:
            print(f"Error al liquidar bonos vencidos: {exc}")
            return []

    def _public_bond(self, bond):
        """Transforma un bono de Firestore en una respuesta estable para la API."""
        started_at = bond.get('started_at')
        maturity_at = bond.get('maturity_at')
        settled_at = bond.get('settled_at')
        started_at = self._ensure_utc(started_at)
        maturity_at = self._ensure_utc(maturity_at)
        settled_at = self._ensure_utc(settled_at)
        now = datetime.now(timezone.utc)
        seconds_remaining = 0

        if bond.get('status') == 'active' and maturity_at:
            seconds_remaining = max(0, math.ceil((maturity_at - now).total_seconds()))

        return {
            'id': bond.get('id', ''),
            'ticker': str(bond.get('ticker', '')).upper(),
            'name': bond.get('name', ''),
            'amount': float(bond.get('amount', 0) or 0),
            'returnPercent': float(bond.get('return_percent', 0) or 0),
            'profit': float(bond.get('profit', 0) or 0),
            'payout': float(bond.get('payout', 0) or 0),
            'durationSeconds': int(bond.get('duration_seconds', 0) or 0),
            'secondsRemaining': seconds_remaining,
            'status': bond.get('status', 'active'),
            'startedAt': started_at.isoformat() if hasattr(started_at, 'isoformat') else None,
            'maturityAt': maturity_at.isoformat() if hasattr(maturity_at, 'isoformat') else None,
            'settledAt': settled_at.isoformat() if hasattr(settled_at, 'isoformat') else None,
            'balanceAfterSettlement': bond.get('balance_after_settlement'),
        }

    def _ensure_utc(self, value):
        if value is None or not hasattr(value, 'tzinfo'):
            return value

        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)

        return value.astimezone(timezone.utc)

    def reiniciar_cartera(self, user_id, saldo_inicial=1000.0):
        """Deja la cartera en el estado inicial y registra el reinicio."""
        user_ref = self.db.collection('usuarios').document(user_id)
        self.obtener_usuario(user_id)
        user_ref.update({
            'saldo': float(saldo_inicial),
            'cartera': {},
        })
        self._registrar_transaccion(user_id, 'REINICIO', 'CASH', 1, saldo_inicial, 0)
        return float(saldo_inicial)

    def eliminar_cuenta(self, user_id):
        """Borra el perfil de Firestore y sus datos de negocio asociados."""
        transacciones = self.db.collection('transacciones')\
                            .where(filter=FieldFilter('usuario', '==', user_id))\
                            .get()
        bonos = self.db.collection('bonos')\
                    .where(filter=FieldFilter('usuario', '==', user_id))\
                    .get()
        batch = self.db.batch()
        operaciones_batch = 0
        transacciones_borradas = 0
        bonos_borrados = 0

        for transaccion in transacciones:
            batch.delete(transaccion.reference)
            operaciones_batch += 1
            transacciones_borradas += 1

            if operaciones_batch == 450:
                batch.commit()
                batch = self.db.batch()
                operaciones_batch = 0

        for bono in bonos:
            batch.delete(bono.reference)
            operaciones_batch += 1
            bonos_borrados += 1

            if operaciones_batch == 450:
                batch.commit()
                batch = self.db.batch()
                operaciones_batch = 0

        if operaciones_batch:
            batch.commit()

        self.db.collection('usuarios').document(user_id).delete()
        return {
            'deleted_transactions': transacciones_borradas,
            'deleted_bonds': bonos_borrados,
        }

    def realizar_compra(self, ticker, cantidad, precio_unidad, user_id="usuario_demo"):
        user_ref = self.db.collection('usuarios').document(user_id)
        user_data = self.obtener_usuario(user_id)
        coste_total = cantidad * precio_unidad
        
        if user_data['saldo'] >= coste_total:
            nuevo_saldo = user_data['saldo'] - coste_total
            cartera = user_data.get('cartera', {})
            cartera[ticker] = cartera.get(ticker, 0) + cantidad
            user_ref.update({'saldo': nuevo_saldo, 'cartera': cartera})
            
            self._registrar_transaccion(user_id, 'COMPRA', ticker, cantidad, precio_unidad, coste_total)
            
            return True, nuevo_saldo
        return False, user_data['saldo']
    
    def realizar_venta(self, ticker, cantidad_a_vender, precio_unidad, user_id="usuario_demo"):
        user_ref = self.db.collection('usuarios').document(user_id)
        user_data = self.obtener_usuario(user_id)
        cartera = user_data.get('cartera', {})
        cantidad_actual = cartera.get(ticker, 0)
        
        if cantidad_actual >= cantidad_a_vender:
            ingreso = cantidad_a_vender * precio_unidad
            nuevo_saldo = user_data['saldo'] + ingreso
            nueva_cantidad = cantidad_actual - cantidad_a_vender
            
            if nueva_cantidad < 0.000001:
                if ticker in cartera: del cartera[ticker]
            else:
                cartera[ticker] = nueva_cantidad
                
            user_ref.update({'saldo': nuevo_saldo, 'cartera': cartera})
            
            self._registrar_transaccion(user_id, 'VENTA', ticker, cantidad_a_vender, precio_unidad, ingreso)
            
            return True, nuevo_saldo
        return False, user_data['saldo']

    def reinvertir_dividendo(self, user_id, ticker, importe_dividendo, precio_unidad):
        """Convierte un dividendo en mas unidades del mismo activo sin tocar el saldo."""
        if importe_dividendo <= 0 or precio_unidad <= 0:
            return False, 0.0

        user_ref = self.db.collection('usuarios').document(user_id)
        user_data = self.obtener_usuario(user_id)
        cartera = user_data.get('cartera', {})
        cantidad = importe_dividendo / precio_unidad

        cartera[ticker] = cartera.get(ticker, 0) + cantidad
        user_ref.update({'cartera': cartera})
        self._registrar_transaccion(
            user_id,
            'DIVIDENDO_REINVERTIDO',
            ticker,
            cantidad,
            precio_unidad,
            importe_dividendo,
        )

        return True, cantidad

    def obtener_usuarios_con_cartera(self):
        """Devuelve usuarios que tienen al menos una posicion en cartera."""
        try:
            docs = self.db.collection('usuarios').stream()
            usuarios = []

            for doc in docs:
                data = doc.to_dict() or {}
                cartera = data.get('cartera') or {}

                if cartera:
                    usuarios.append({
                        'id': doc.id,
                        'cartera': cartera,
                    })

            return usuarios
        except Exception as exc:
            print(f"Error al consultar usuarios con cartera: {exc}")
            return []

    def obtener_historial(self, user_id):
        try:
            docs = self.db.collection('transacciones')\
                        .where(filter=FieldFilter('usuario', '==', user_id))\
                        .get()
            transacciones = []

            for doc in docs:
                transaccion = doc.to_dict()
                transaccion['id'] = doc.id
                transacciones.append(transaccion)

            return sorted(
                transacciones,
                key=lambda transaccion: transaccion.get('fecha') or '',
                reverse=True,
            )[:20]
        except Exception as exc:
            print(f"Error al consultar historial: {exc}")
            return []

    def obtener_transacciones_usuario(self, user_id):
        """Devuelve todas las transacciones del usuario ordenadas de mas antigua a mas reciente."""
        try:
            docs = self.db.collection('transacciones')\
                        .where(filter=FieldFilter('usuario', '==', user_id)).get()
            transacciones = [doc.to_dict() for doc in docs]

            return sorted(
                transacciones,
                key=lambda transaccion: transaccion.get('fecha') or '',
            )
        except Exception as exc:
            print(f"Error al consultar transacciones del usuario: {exc}")
            return []
