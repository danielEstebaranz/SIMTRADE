# SIMTRADE

SIMTRADE es una aplicación desarrollada como Trabajo de Fin de Grado por Daniel Estebaranz Hernando y Raúl Marzal Utrilla. El objetivo del proyecto es acercar el mundo de la inversión a usuarios principiantes mediante una simulación segura con cartera, mercado, estadísticas, bonos, historial, configuración de cuenta y asistente IA.

El repositorio está dividido en dos partes:

- `Simtrade-BackEnd`: API en Python con FastAPI, conexión a Firebase Firestore y consulta de datos de mercado con Finnhub/yfinance.
- `Simtrade-FrontEnd`: aplicación web en Angular.

## Requisitos previos

Antes de ejecutar el proyecto hay que tener instalado:

- Python 3.13 o una versión compatible de Python 3.
- Node.js y npm.
- Git, si se va a clonar desde repositorio.


## Archivos privados necesarios


Dentro de `Simtrade-BackEnd` debe existir un archivo `.env` con estas variables:

env:
FINNHUB_API_KEY=clave_de_finnhub
FIREBASE_JSON_PATH=service_account.json
FIREBASE_WEB_API_KEY=clave_web_de_firebase


En esa misma carpeta(SImtrade-BackEnd) debe colocarse también el archivo:

service_account.json

Ese archivo es la clave privada de Firebase Admin SDK.

## Instalación del backend

Abrir una terminal en la carpeta del backend:

cd Simtrade-BackEnd

Instalar las dependencias:

pip install -r requirements.txt

Comprobar que existen los archivos privados:

Simtrade-BackEnd/.env
Simtrade-BackEnd/service_account.json

Arrancar la API:

python api_server.py

Si todo está correcto, el backend quedará escuchando en:

http://127.0.0.1:8000


## Instalación del frontend

Abrir otra terminal en la carpeta del frontend:

cd Simtrade-FrontEnd

Instalar las dependencias:

npm install


Arrancar Angular:

npm start

La aplicación se abrirá en:

http://localhost:4200

El frontend está configurado para conectarse al backend en `http://127.0.0.1:8000`, por lo que el backend debe estar arrancado antes de usar login, cartera, mercado, bonos, historial o configuración.

## Chat IA con n8n

El asistente IA del frontend usa un webhook de n8n Cloud ya configurado en el servicio de chat.



## Orden recomendado para probar

1. Descomprimir el ZIP o clonar el repositorio.
2. Colocar `.env` y `service_account.json` dentro de `Simtrade-BackEnd`.
3. Abrir una terminal en `Simtrade-BackEnd`.
4. Ejecutar `pip install -r requirements.txt`.
5. Ejecutar `python api_server.py`.
6. Abrir otra terminal en `Simtrade-FrontEnd`.
7. Ejecutar `npm install`.
8. Ejecutar `npm start`.
9. Entrar en `http://localhost:4200`.