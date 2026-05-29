# Documentacion de Simtrade BackEnd

Esta carpeta resume los cambios de backend anadidos para que el frontend pueda gestionar cuenta, fondos y cartera desde la interfaz grafica.

## API principal

Archivo:

api_server.py

La API esta hecha con FastAPI y expone endpoints HTTP para que Angular no tenga que llamar directamente a Firestore ni a funciones de consola.

## Endpoints de mercado

GET /market/assets
GET /market/statistics

### `GET /market/assets`

Devuelve el catalogo de activos disponibles para que el frontend no tenga que mantener su propia lista principal.

La lista comun vive en:

services/market_assets.py

La usan tanto `api_server.py` como `services/worker_precios.py`, de modo que la API y el worker trabajan con los mismos tickers.

### `GET /market/statistics`

Calcula rendimientos diarios y semanales de los activos disponibles y devuelve:

- mejor activo diario
- peor activo diario
- mejor activo semanal
- peor activo semanal
- listados completos por rango

Esto permite que la pestaña `Estadisticas` del frontend solo tenga que representar los datos.

## Endpoints de configuracion y cuenta

GET    /users/me/settings
PATCH  /users/me/settings
POST   /users/me/funds
POST   /users/me/funds/withdraw
POST   /users/me/portfolio/reset
POST   /users/me/delete
DELETE /users/me

### `POST /users/me/funds`

Suma saldo disponible al usuario autenticado.

Flujo:

1. verifica token Firebase
2. valida cantidad con `normalize_funds_amount`
3. llama a `DbHandler.anadir_fondos`
4. registra movimiento `DEPOSITO`
5. devuelve el usuario actualizado

### `POST /users/me/funds/withdraw`

Resta saldo disponible.

Reglas:

- la cantidad debe ser mayor que 0
- no puede superar el maximo permitido por operacion
- no puede ser mayor que el saldo disponible

Si todo es correcto, `DbHandler.retirar_fondos` actualiza el saldo y registra `RETIRADA`.

El frontend transforma ese movimiento en una notificacion del historial:

Has retirado X $ del saldo.

### `POST /users/me/portfolio/reset`

Reinicia la cartera.

Body esperado:

{
  "confirmation": "REINICIAR",
  "password": "contraseña_actual"
}

Seguridad:

1. exige token valido
2. exige palabra exacta `REINICIAR`
3. verifica la contraseña contra Firebase Authentication con `signInWithPassword`
4. comprueba que el `localId` devuelto coincide con el usuario autenticado

Despues llama a `DbHandler.reiniciar_cartera`, que deja:

saldo = 1000.0
cartera = {}

Y registra una transaccion `REINICIO`.



### `POST /users/me/delete`

Borra la cuenta solo si la contraseña es correcta.

Se creo este endpoint para evitar depender del viejo `DELETE /users/me` sin cuerpo claro desde el frontend. El endpoint `DELETE` se mantiene, pero tambien exige password.

## DbHandler

Archivo:

services/db_handler.py

Metodos anadidos:

retirar_fondos(user_id, cantidad)
reiniciar_cartera(user_id, saldo_inicial=1000.0)

`retirar_fondos` comprueba saldo suficiente antes de actualizar Firestore.

`reiniciar_cartera` vacia la cartera y restaura el saldo inicial. No borra la cuenta.

## Calculos auxiliares tras retiradas y reinicios

Las retiradas y reinicios tambien afectan a los calculos usados para estimar ganancias cuando no hay historial de compras suficiente:

- `RETIRADA` resta del total de fondos anadidos.
- `REINICIO` limpia costes abiertos anteriores y resetea la estimacion.

Esto evita que una retirada de efectivo o un reinicio de cartera distorsionen las ganancias estimadas.

## Errores corregidos en el proceso

### Cuenta borrada con contraseña incorrecta

Se reforzo el backend para verificar la contraseña con Firebase Authentication antes de borrar o reiniciar. La comprobacion valida que el `localId` de Firebase coincida con el usuario del token.

### Backend antiguo en puerto 8000

Si un proceso viejo sigue usando `127.0.0.1:8000`, el frontend puede llamar a una version antigua de la API. Cuando se cambian endpoints hay que parar el proceso antiguo y reiniciar `api_server.py`.


### Activos duplicados entre frontend y backend

Antes la lista de activos podia estar repetida en varios sitios. Al anadir nuevos activos, el worker podia conocerlos pero Mercado no.

Se creo `services/market_assets.py` como fuente unica en backend y el frontend paso a pedir la lista mediante `/market/assets`.

## Comprobacion

Comando usado para validar sintaxis:

python -m py_compile api_server.py services/db_handler.py