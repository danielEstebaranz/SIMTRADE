# SimTrade - Simulador de Inversiones

Este repositorio contiene el backend del proyecto SimTrade, un TFG orientado a simular operaciones de inversion de forma didactica y segura.

## Componentes principales

- [main.py] aplicacion de consola para registro, login, cartera, compras, ventas e historial.
- [api_server.py]: API HTTP para autenticacion, configuracion, fondos, bonos, cartera, historico y mercado desde el frontend.
- [services/worker_precios.py]: sincronizador de precios desde Finnhub hacia Firestore.
- [services/Api_Handler.py]: acceso a Finnhub para precio actual y yfinance para historicos.
- [services/db_handler.py]: acceso a Firestore y logica de usuarios, saldo, cartera, historial y bonos.

## Dependencias

Instaladas desde [requirements.txt]:

- `python-dotenv`
- `finnhub-python`
- `firebase-admin`
- `fastapi`
- `uvicorn`
- `yfinance`
- `requests`

## Variables de entorno

- `FINNHUB_API_KEY`
- `FIREBASE_JSON_PATH`
- `SIMTRADE_API_HOST`
- `SIMTRADE_API_PORT`
- `FIREBASE_WEB_API_KEY`

## Funcionalidades actuales

- Registro e inicio de sesion con Firebase Authentication.
- Perfil, saldo, cartera e historial persistidos en Firestore.
- Compra y venta de activos con precio real consultado desde el backend.
- Gestion de configuracion: tema claro/oscuro, fondos, retirada, reinicio y borrado de cuenta.
- Bonos temporales: el usuario invierte saldo en un bono, espera 60 segundos y recibe principal mas rentabilidad cuando vence.
- Historial de movimientos: compras, ventas, depositos, retiradas, reinicio, inversion en bonos y cierre de bonos.



## Nota sobre el asistente virtual

El asistente virtual de soporte no forma parte de este backend Python. Vive como integracion externa en n8n y el frontend lo consume directamente mediante HTTP. El backend sigue siendo responsable de autenticacion, datos de negocio y mercado.
