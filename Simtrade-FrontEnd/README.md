# SIMTRADE FrontEnd

Frontend Angular del TFG Simtrade. Incluye autenticación, panel protegido, cartera, mercado, bonos temporales, historial, estadisticas, perfil, configuración y centro de ayuda con asistente virtual conectado a n8n.

## Funcionalidades principales

- Login y registro contra el backend FastAPI.
- Operativa de compra y venta de activos.
- Bonos temporales: contratación de bonos por saldo, contador de vencimiento, liquidacion automática y rastro en historial.
- Gráficas reales con Chart.js.
- Gestión de fondos, reinicio de cartera y borrado de cuenta.
- Tema claro/oscuro persistente.
- Login con tema claro fijo aunque el usuario tenga modo oscuro guardado.
- Perfil sin mostrar identificadores internos del usuario.
- Bonos legibles en tema oscuro con reglas de contraste propias.
- FAQ y chat de soporte de SIMTRADE en `/panel/ayuda`.
- Integración con n8n para el asistente virtual mediante `src/app/services/chat.ts`.

## Secciones principales

- `/login`: acceso y registro. Mantiene estetica clara fija para evitar que el tema oscuro del panel cambie la pantalla inicial.
- `/panel/cartera`: resumen de saldo, posiciones y ganancias.
- `/panel/mercado`: listado de activos y compra por importe.
- `/panel/bonos`: ofertas de bonos, inversion por importe, bonos activos y bonos liquidados.
- `/panel/historial`: rastro de compras, ventas, depositos, retiradas, reinicios, inversiones en bonos y cierres de bonos.
- `/panel/estadisticas`: estadisticas de mercado.
- `/panel/configuracion`: tema, fondos, reinicio de cartera y borrado de cuenta.
- `/panel/ayuda`: FAQ y chat conectado a n8n.

## Bonos temporales

La pantalla de bonos usa `AccountService` para consumir:

GET  /bonds/offers
GET  /users/me/bonds
POST /users/me/bonds
POST /users/me/bonds/settle

Flujo:

1. El usuario elige una oferta, por ejemplo Amazon.
2. Introduce la cantidad a invertir.
3. El backend descuenta el saldo y devuelve un bono activo con `maturityAt`.
4. El frontend calcula el contador con `maturityAt`, no restando a ciegas.
5. Cuando el contador llega a 0, llama a liquidar bonos vencidos.
6. El saldo se actualiza con `user` devuelto por backend.
7. Historial muestra `bono_inversion` y `bono_cierre`.

Los bonos no dependen de tener comprada la accion en cartera. Un bono de Tesla se puede contratar aunque el usuario no tenga acciones de Tesla, porque es una oferta temporal independiente de la cartera.

Estetica actual:

- Los bonos activos estan alineados a la izquierda.
- Todos usan el mismo ancho para que la lista sea simetrica.
- Los bonos liquidados aparecen en un bloque separado.

## Servicios Angular

- `AuthService`: login, registro, sesion, usuario actual y sincronización del tema guardado.
- `MarketService`: mercado, compra, venta, cartera, ganancias e historial.
- `AccountService`: configuración, fondos, retiradas, reinicio, borrado de cuenta y bonos.
- `ThemeService`: aplica `data-theme` en el documento y guarda preferencia en `localStorage`.
- `ChatService`: comunica el chat de ayuda con n8n.

## Librerias usadas

- `@angular/core`, `@angular/common`, `@angular/router`, `@angular/forms`: base de la aplicacion, componentes standalone, rutas y formularios reactivos.
- `@angular/common/http`: llamadas HTTP al backend FastAPI y al webhook de n8n.
- `rxjs`: manejo de observables y suscripciones HTTP.
- `chart.js`: gráficas de tendencia y cartera.
- `express` y `@angular/ssr`: soporte SSR generado por Angular.
- `vitest` y `jsdom`: base disponible para tests.
- `typescript`: tipado de la aplicación.

## Errores corregidos recientes

### Fondos manuales no se aplicaban

Los botones rápidos funcionaban, pero la cantidad escrita manualmente podia viajar como texto. El backend ahora acepta numero o texto y el frontend normaliza comas decimales antes de enviar.

### Login heredaba el modo oscuro

El login queda fijado con `color-scheme: light` y fondo claro para que el tema oscuro solo afecte al panel.

### Bonos no se liquidaban al primer contador a 0

El contador ahora se calcula con `maturityAt`. Si hay un bono vencido, el frontend llama a `settleBonds`; al recargar `/panel/bonos`, `GET /users/me/bonds` tambien liquida vencidos desde backend.

### Historial no explicaba los bonos

`HistorialSection` ahora muestra mensajes especificos para:


bono_inversion
bono_cierre


### Bonos activos desalineados

La lista se dejo en columna simetrica, todos pegados a la izquierda y con el mismo ancho.

### Bonos con poco contraste en modo oscuro

Los textos de `Bonos temporales`, `Elige un bono` y `Bonos activos` quedaban demasiado oscuros. Se reforzaron los colores del componente en tema oscuro con `:host-context([data-theme='dark'])`.

### Perfil mostraba identificador interno

El perfil mostraba el `id` tecnico del usuario. Se retiro de la interfaz: el dato sigue disponible internamente para autenticacion y servicios, pero no se enseña al usuario final.

## Servicios locales necesarios

```text
Frontend Angular: http://localhost:4200
Backend FastAPI:  http://127.0.0.1:8000
n8n Cloud:        https://simtrade.app.n8n.cloud
```

El chat usa el workflow publicado de n8n:


POST https://simtrade.app.n8n.cloud/webhook/70182b73-2c1e-49d3-b99c-41aaa164ef52/chat

La petición envía `chatInput` y `sessionId`; el `sessionId` permite que la memoria del agente conserve el contexto de la conversación.

## Servidor de desarrollo

Para iniciar un servidor de desarrollo local, ejecuta:

ng serve

Una vez que el servidor esté en funcionamiento, abre tu navegador y navega a `http://localhost:4200/`. La aplicación se recargará automáticamente cada vez que modifiques cualquiera de los archivos fuente.

## Generación de código

Angular CLI incluye potentes herramientas de generación de código. Para generar un nuevo componente, ejecuta:


ng generate component component-name

Para obtener una lista completa de los esquemas disponibles, como `components`,`directives`,`pipes`, ejecuta:

ng generate --help

## Construcción 

Para construir el proyecto, ejecuta:

ng build

Esto compilará el proyecto y almacenará los artefactos de construcción en el directorio `dist/`. Por defecto, la construcción de producción optimiza tu aplicación para rendimiento y velocidad.

## Ejecuta de pruebas unitarias

Para ejecutar pruebas unitarias con el ejecutor de pruebas `Vitest, usa el siguiente comando:

ng test

## Ejecución de pruebas end-to-end

Para pruebas end-to-end, ejecuta:

ng e2e

Angular CLI no viene con un framework de pruebas end-to-end por defecto. Puedes elegir uno que se adapte a tus necesidades.

## Recursos adicionales 

Para obtener más información sobre el uso de Angular CLI, incluidas referencias detalladas de comandos, visita la página `https://angular.dev/tools/cli`
