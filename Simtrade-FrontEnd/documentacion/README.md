# Documentacion de Simtrade FrontEnd

Esta carpeta recoge una explicacion detallada de la aplicacion, las decisiones tomadas y los problemas que fueron apareciendo durante el desarrollo.

## Documentos

- [01-arquitectura.md](./01-arquitectura.md): estructura general del proyecto Angular.
- [02-componentes.md](./02-componentes.md): componentes creados y responsabilidad de cada uno.
- [03-login-y-backend.md](./03-login-y-backend.md): flujo de login gráfico y conexión con el backend.
- [04-rutas-y-navegacion.md](./04-rutas-y-navegacion.md): rutas, guard de autenticacion y enlaces del sidebar.
- [05-assets-e-iconos.md](./05-assets-e-iconos.md): logo, favicon, carpeta `public` e imagen redondeada.
- [06-errores-y-soluciones.md](./06-errores-y-soluciones.md): errores encontrados y como se corrigieron.
- [07-comandos.md](./07-comandos.md): comandos utiles para arrancar y comprobar la aplicación.
- [08-estructura-del-proyecto.md](./08-estructura-del-proyecto.md): arbol de carpetas y para que sirve cada archivo importante.
- [09-conceptos-angular-usados.md](./09-conceptos-angular-usados.md): conceptos como `router-outlet`, `routerLink`, guards, signals y formularios reactivos.
- [10-cartera-y-graficas.md](./10-cartera-y-graficas.md): acciones del usuario, grafica real, Chart.js, valor actual, dinero invertido, ventas por porcentaje, reinversion automatica por worker, rangos 1 dia/semana/año y conexión con mercado.
- [11-librerias-metodologia-y-faq.md](./11-librerias-metodologia-y-faq.md): librerias usadas, metodologia seguida, puntos debiles y preguntas típicas.
- [12-ayuda-y-chat-ia.md](./12-ayuda-y-chat-ia.md): centro de ayuda, FAQ, integración con n8n y alcance funcional del asistente.
- [13-despliegue.md](./13-despliegue.md): plan de alojamiento, cambios previos necesarios, riesgos y preparacion de la demo.

## Resumen rapido

La aplicación es un frontend Angular moderno que tiene:

- Una pantalla de login y registro.
- Un servicio de autenticación que llama al backend.
- Un panel principal protegido por sesión.
- Un sidebar reutilizable con navegación interna.
- Rutas hijas reales dentro del panel: cartera, mercado, historial, estadisticas, configuracion, perfil y ayuda.
- Compra de acciones desde mercado mediante un popup de importe a invertir.
- Venta de acciones desde cartera mediante porcentajes rapidos o porcentaje personalizado.
- Una conexión HTTP con una API Python que reutiliza el backend existente de consola y Firestore.
- Una vista de cartera con acciones del usuario, nombre legible del activo, dinero invertido, valor actual por posicion y grafica de tendencia real usando datos del backend.
- Una vista de estadisticas con mejores y peores rendimientos diarios y semanales de mercado.
- Una vista de perfil separada de configuración, accesible desde el icono redondo de la cabecera, con resumen de cuenta y gráfica de distribucion de cartera.
- El perfil no muestra identificadores internos del usuario; solo datos utiles como email, tema, saldo, activos y cartera.
- Una vista de configuración conectada al backend para tema claro/oscuro, añadir fondos, quitar fondos, reiniciar cartera y borrar cuenta.
- Tema visual persistente en `localStorage`, sincronizado con `settings.theme` del perfil del usuario.
- Fondo del sidebar distinto en tema claro y oscuro mediante variables CSS e imagenes dedicadas.
- Ajustes especificos de contraste para que Bonos sea legible en tema oscuro.
- Historial con compras, ventas, depositos, retiradas y reinicios, cada uno con mensaje propio. Las reinversiones internas de dividendos se ocultan por petición funcional.
- Centro de ayuda con FAQ desplegable y acceso al asistente virtual de SIMTRADE.
- Chat conectado a un workflow de n8n con memoria por sesion y respuestas restringidas al dominio funcional del proyecto.

El backend original funcionaba por consola. Para que el navegador pudiera usarlo, se creo una API HTTP pequeña en el repositorio backend, porque un navegador no puede llamar directamente a funciones Python de consola.
