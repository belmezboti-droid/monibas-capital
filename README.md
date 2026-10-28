# Monibas Capital · versión 2.0

*Invierte con cabeza, no con corazonadas.*

Plataforma educativa para aprender a invertir desde cero. Incluye:

- una ruta de 8 niveles en 3 etapas (básico, intermedio y avanzado), con 64 preguntas de test;
- gráficos explicados y un simulador de interés compuesto;
- un foro multiusuario y un consultor IA;
- titulares financieros en directo;
- 4 idiomas completos: español, inglés, francés y alemán;
- **Premium por 4,99 €/mes** (pago con Stripe): 4 módulos Pro con sus tests, modo examen, 4 herramientas exclusivas, el cuádruple de consultas a la IA y sin anuncios.

> Contenido educativo, no asesoramiento financiero.

---

## 1. Qué hay en la carpeta

```
server.js            Servidor (Express): sirve la web y la API desde el mismo origen
public/
  index.html         Página única (sin scripts en línea)
  css/styles.css     Diseño completo: temas claro/oscuro y adaptación a móvil
  js/app.js          Lógica de la aplicación
  js/charts.js       Gráficos SVG propios
  js/interactive.js  Gráfico explorable de la portada y simuladores (reto «¿sube o baja?», comisiones, cartera, tamaño de posición)
  locales/*.js       Textos en es / en / fr / de (todo el contenido, no solo la interfaz)
premium/             Contenido Premium (módulos, tests y herramientas). Está FUERA de public/:
  es|en|fr|de.json   el servidor solo lo entrega a suscriptores activos
  tools.js
scripts/check.js     Comprobaciones automáticas antes de publicar
scripts/make-admin.js     Nombra moderadores del foro
scripts/grant-premium.js  Da o retira Premium a mano (regalos, pruebas, atención al cliente)
.env.example         Plantilla de configuración
Dockerfile, render.yaml
```

## 2. Instalación en tu ordenador

Necesitas **Node.js 18.18 o superior** (recomendado 20 LTS).

```bash
cd monibas-capital-1
npm install
cp .env.example .env      # en Windows: copy .env.example .env
npm run check             # comprueba traducciones, tests y sintaxis
npm start
```

Tras el primer `npm install` se crea `package-lock.json`: **guárdalo junto al proyecto** (y súbelo a GitHub). Fija las versiones exactas de las dependencias, y Docker y Render lo usarán con `npm ci` para instalar siempre lo mismo que has probado.

Abre **http://localhost:4000**. La web y el servidor funcionan juntos, así que ya **no hace falta `npx serve`** ni configurar `API_BASE` como en la versión anterior.

### Activar el consultor IA

1. Crea una clave en https://console.anthropic.com.
2. Pégala en `.env` como `ANTHROPIC_API_KEY=...`.
3. Reinicia con `npm start`.

La clave se queda en el servidor y nunca llega al navegador. Sin clave, el consultor muestra un aviso traducido indicando que no está activado.

## 3. Migrar desde la versión anterior (servidor-foro)

Tus usuarios, contraseñas y mensajes se conservan: el esquema de la base de datos es compatible.

1. Para el servidor antiguo.
2. Crea la carpeta `data/` dentro del proyecto nuevo.
3. Copia el archivo antiguo `servidor-foro/foro.db` a `monibas-capital-1/data/foro.db`.
4. Ejecuta `npm start`. Las columnas nuevas (idioma, progreso y versión de sesión) se añaden automáticamente.
5. Ya puedes borrar la carpeta antigua y el archivo HTML suelto: la página ahora la sirve el propio servidor.

## 4. Variables de entorno (`.env`)

| Variable | Para qué sirve |
|---|---|
| `NODE_ENV` | `production` en el servidor público: activa cookies seguras, HSTS y comprobaciones estrictas |
| `PORT` | Puerto (por defecto 4000) |
| `JWT_SECRET` | **Obligatorio en producción**, mínimo 32 caracteres. Genera uno con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DATA_DIR` | Carpeta de la base de datos. En producción, un **disco persistente** |
| `AI_DAILY_LIMIT` | Tope global de consultas al consultor IA por día (por defecto 500; `0` = sin tope). Protege tu factura aunque alguien cree muchas cuentas |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | Consultor IA (modelo por defecto: `claude-sonnet-5`) |
| `NEWS_FEEDS` | Feeds RSS de los titulares (separados por comas) |
| `TRUST_PROXY` | Número de proxies por delante (Render, Railway o nginx: `1`) |
| `ALLOWED_ORIGINS` | Solo si sirves la web desde otro dominio. Normalmente, vacío |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | Pagos de Premium (ver apartado 6). Si falta alguna, el botón de suscribirse aparece desactivado y el resto de la web funciona igual |
| `STRIPE_AUTOMATIC_TAX` | `true` si activas Stripe Tax para calcular el IVA según el país |
| `PUBLIC_URL` | Dirección https de la web (por ejemplo `https://monibascapital.com`). **Obligatoria en producción si hay pagos**: es adonde vuelve Stripe tras pagar |

**Nunca subas `.env` a GitHub.** Ya está incluido en `.gitignore`.

## 5. Publicar en Internet

SQLite guarda los datos en un archivo, así que el servidor necesita un **disco persistente**. En discos temporales (el plan gratuito de muchos servicios) perderías usuarios y mensajes en cada reinicio.

### Opción A · Render (la más sencilla)

1. Sube el proyecto a un repositorio privado de GitHub.
2. En Render, elige *New → Blueprint* y selecciona el repositorio. Se usará `render.yaml`, que:
   - crea un plan con disco persistente en `/var/data`;
   - genera `JWT_SECRET` automáticamente.
3. En *Environment*, añade `ANTHROPIC_API_KEY`. Para ser moderador, regístrate en la web y ejecuta en la consola (*Shell*) de Render: `npm run make-admin -- tu@correo.com`.
4. Render te da un dominio con HTTPS. También puedes añadir el tuyo.

### Opción B · Railway

Crea un servicio desde el repositorio, añade un **Volume** montado en `/data` y define:

- `DATA_DIR=/data`
- `NODE_ENV=production`
- `JWT_SECRET`
- el resto de variables que necesites.

### Opción C · Docker (cualquier VPS)

```bash
docker build -t cuaderno .
docker run -d --name cuaderno -p 4000:4000 \
  -e NODE_ENV=production -e JWT_SECRET=... -e DATA_DIR=/data \
  -v cuaderno-datos:/data --restart unless-stopped cuaderno
```

### Opción D · VPS con nginx

Ejecuta `npm start` con un gestor de procesos (`pm2` o systemd) y pon nginx delante como proxy inverso, con HTTPS gratuito de Let's Encrypt (`certbot --nginx`). Deja `TRUST_PROXY=1`.

**Siempre con HTTPS.** En producción la cookie de sesión solo viaja cifrada.

## 6. Premium (4,99 €/mes)

### Qué incluye

| | Gratis | Premium |
|---|---|---|
| Ruta de 8 niveles, simuladores, reto, foro | ✓ | ✓ |
| 4 módulos Pro (fiscalidad, derivados, valoración DCF, riesgo y psicología) con 8 preguntas cada uno | — | ✓ |
| Modo examen: 20 preguntas al azar de toda la ruta y los módulos, con cronómetro y resultados por tema | — | ✓ |
| Herramientas: Monte Carlo de trading, matemática de las pérdidas, independencia financiera (FIRE), calculadora DCF con tabla de sensibilidad | — | ✓ |
| Consultas a la IA por hora | 30 | 120 |
| Anuncios | Sí (propios) | No |

**Sobre los anuncios.** La web no tenía publicidad, así que no había nada que quitar. Los usuarios gratuitos ven ahora **anuncios propios y discretos** que promocionan Premium (en la portada y a mitad de cada nivel); los suscriptores no ven ninguno. No hay redes publicitarias ni rastreo, así que **no hace falta banner de cookies**. Si algún día añades AdSense u otra red, necesitarás un banner de consentimiento certificado (CMP) y actualizar la política de privacidad.

### Cómo está protegido

- El contenido Premium vive en `premium/`, **fuera de `public/`**. El servidor solo lo entrega (`/api/premium/content` y `/api/premium/tools.js`) a quien tiene Premium activo; a los demás responde 401/403. No basta con tocar el JavaScript del navegador.
- La web nunca ve datos de tarjeta: el pago se hace en la página de Stripe (Checkout) y la gestión en su portal de cliente.
- El acceso se activa **solo** cuando llega el aviso firmado de Stripe (webhook). Se verifica la firma HMAC-SHA256 con comparación de tiempo constante, se rechazan avisos de más de 5 minutos (reenvíos), se ignoran avisos repetidos y los que llegan desordenados, y la baja tardía de una suscripción antigua no corta una nueva.
- Si el pago de una renovación falla, Stripe reintenta durante unos días (`past_due`) y el usuario conserva el acceso; si acaba impagada o se cancela, se retira. Hay 2 días de margen tras cada periodo para que la renovación no corte el acceso.
- No se puede pagar dos veces (`ALREADY_PREMIUM`), y al **borrar la cuenta se cancela antes la suscripción**; si Stripe no responde, la cuenta no se borra (así nunca se cobra a una cuenta inexistente).
- Las direcciones de pago se comprueban en el servidor y en el navegador: solo se redirige a `checkout.stripe.com` y `billing.stripe.com`.

### Activar los pagos (unos 20 minutos)

1. Crea una cuenta en [stripe.com](https://stripe.com) y completa los datos de tu negocio (autónomo o sociedad) y tu cuenta bancaria.
2. Trabaja primero en **modo de prueba**. En *Catálogo de productos*, crea el producto «Monibas Capital Premium» con un **precio recurrente mensual de 4,99 EUR**. Copia el ID del precio (`price_…`) en `STRIPE_PRICE_ID`.
3. En *Desarrolladores → Claves de API*, copia la clave secreta (`sk_test_…`) en `STRIPE_SECRET_KEY`.
4. En *Desarrolladores → Webhooks*, añade el endpoint `https://TU-DOMINIO/api/billing/webhook` con estos eventos:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` y `customer.subscription.deleted`.
   Copia el secreto de firma (`whsec_…`) en `STRIPE_WEBHOOK_SECRET`.
5. En *Configuración → Facturación → Portal de clientes*, actívalo y permite **cancelar la suscripción** y **actualizar el método de pago**.
6. Pon `PUBLIC_URL=https://TU-DOMINIO` y reinicia el servidor.
7. Prueba con la tarjeta `4242 4242 4242 4242` (cualquier fecha futura y CVC): tras pagar volverás a la web y Premium se activará en unos segundos. Prueba también a cancelar desde *Gestionar suscripción*.
8. Cuando todo funcione, repite los pasos 2–4 en **modo real** y cambia las tres claves.

Para probar en tu ordenador sin dominio público, usa la [CLI de Stripe](https://docs.stripe.com/stripe-cli): `stripe listen --forward-to localhost:4000/api/billing/webhook` te da un `whsec_…` temporal.

### Dar Premium a mano

```bash
npm run grant-premium -- correo@ejemplo.com 30        # 30 días gratis
npm run grant-premium -- correo@ejemplo.com --remove  # retirarlo
```

Útil para regalos, colaboradores o atención al cliente. Solo se puede ejecutar en el servidor.

### Antes de cobrar: aspectos legales (España / UE)

No soy abogado: confirma estos puntos con un asesor o gestor.

- **Alta fiscal:** para cobrar de forma habitual necesitas estar dado de alta (autónomo o sociedad).
- **IVA:** los servicios digitales a particulares de la UE tributan con el IVA del país del cliente (régimen OSS/ventanilla única). El precio se muestra como «IVA incluido»; activa **Stripe Tax** (`STRIPE_AUTOMATIC_TAX=true`) o ajusta el precio con tu gestor.
- **Condiciones de contratación:** precio, renovación mensual automática, cómo cancelar y quién eres. Enlázalas cerca del botón de pago.
- **Derecho de desistimiento (14 días):** en contenido digital se pierde si el cliente pide empezar ya y reconoce que lo pierde. La web exige marcar esa casilla antes de pagar; recógelo también en tus condiciones.
- **Política de privacidad:** añade que los pagos los procesa Stripe (encargado del tratamiento) y qué datos se le envían (correo e identificador de usuario).

## 7. Revisión de seguridad (qué se ha corregido)

| Área | Antes | Ahora |
|---|---|---|
| Consultor IA | Llamaba a la API desde el navegador: no funcionaba fuera de claude.ai y exigiría exponer la clave | Proxy en el servidor: la clave nunca sale de él. Requiere sesión, tiene límite de 30 consultas por hora y usuario (120 con Premium), valida y recorta la conversación, y aplica un tiempo máximo de espera |
| XSS | Parte del contenido se insertaba como HTML | Los mensajes del foro, las respuestas de la IA y los titulares se insertan **siempre como texto**. Solo se usa HTML en textos propios (archivos de idioma y gráficos), revisados automáticamente por `npm run check` |
| CSP | Scripts y estilos en línea, CDN externos | `default-src 'self'` sin `unsafe-inline`. GSAP y las fuentes se sirven desde el propio servidor, sin CDN (así además se evita enviar datos a Google Fonts, que tiene implicaciones RGPD) |
| CSRF | Sin protección específica | Cookie `SameSite=Strict`, cabecera obligatoria `X-Requested-With`, comprobación de `Origin` y solo se acepta JSON |
| CORS | Abierto para desarrollo | Desactivado: todo va en el mismo origen. Solo se activa si defines `ALLOWED_ORIGINS` |
| Sesiones y cookies | Cierre de sesión solo en el navegador | Cookie `httpOnly`, `Secure` y con prefijo `__Host-` en producción. JWT firmado con algoritmo fijado (HS256). El cierre de sesión **invalida el token en el servidor** (`token_version`) |
| Contraseñas | bcrypt | bcrypt de coste 12 asíncrono, límite de 72 bytes y comparación de tiempo constante también con correos inexistentes, para no revelar qué correos están registrados |
| Fuerza bruta y abuso | Sin límites | Límites de peticiones: global, inicio de sesión y registro (20 cada 15 min), escritura (12 por minuto) e IA |
| Validación | Básica | Usuario, correo, longitudes, temas, identificadores y progreso validados en el servidor. Se eliminan caracteres de control. Cuerpo máximo de 32 KB |
| SQL injection | Consultas preparadas | Se mantienen consultas preparadas en todas las operaciones |
| Autorización | Administradores por correo en `ADMIN_EMAILS`: como el registro no verifica el correo, **cualquiera podía registrarse con ese correo y obtener permisos de moderación** | Los administradores se guardan en la base de datos y solo se nombran desde el servidor con `npm run make-admin -- correo`. Solo el autor o un administrador pueden borrar mensajes, y se comprueba en el servidor |
| Suplantación | — | Nombres reservados (admin, moderador, soporte, Monibas…), normalización Unicode y eliminación de caracteres invisibles y de control de dirección (que permiten camuflar nombres o texto) |
| Fuerza bruta distribuida | Solo límite por IP | Además, bloqueo de 15 min tras 10 intentos fallidos contra **la misma cuenta**, aunque vengan de muchas IP |
| Coste de la IA | Límite por usuario | Además, tope global diario (`AI_DAILY_LIMIT`) |
| RGPD | Sin forma de darse de baja | En *Ajustes → Eliminar mi cuenta* (con contraseña) se borran la cuenta, el progreso y todos sus mensajes |
| Cachés | — | Ninguna respuesta de la API con datos de usuario se guarda en cachés intermedias (`Cache-Control: no-store`) |
| Docker | Faltaba `.dockerignore`: la imagen podía incluir `.env` y la base de datos | `.dockerignore` excluye `.env`, `data/`, bases de datos y `node_modules` |
| Errores | Podían mostrar detalles internos | La API solo devuelve códigos (`INVALID_CREDENTIALS`…), que la web traduce. Nunca envía trazas del servidor |
| Secretos | — | En producción el servidor **se niega a arrancar** sin un `JWT_SECRET` válido |
| Navegador | — | `localStorage` solo guarda idioma, tema, progreso y valores del simulador. Nada sensible |
| Cabeceras | — | Helmet (HSTS en producción, `frame-ancestors 'none'`, `Referrer-Policy`, `nosniff`), `Permissions-Policy` y sin `X-Powered-By` |
| Titulares | — | Se limpian las etiquetas HTML y solo se aceptan enlaces `http(s)`. Caché de 15 minutos |
| Pagos y Premium | — | Ver apartado 6: contenido servido solo a suscriptores, webhook firmado y a prueba de reenvíos, sin datos de tarjeta en el servidor |

## 8. Lista de comprobación antes de publicar

- [ ] `npm run check` sin errores.
- [ ] `npm audit --omit=dev` sin vulnerabilidades altas. Si aparecen, ejecuta `npm audit fix` y vuelve a probar.
- [ ] `NODE_ENV=production` y un `JWT_SECRET` largo y aleatorio.
- [ ] HTTPS activo.
- [ ] Disco persistente configurado en `DATA_DIR`.
- [ ] Regístrate en la web y hazte moderador con `npm run make-admin -- tu@correo.com`.
- [ ] `package-lock.json` guardado en el proyecto.
- [ ] Copias de seguridad periódicas de `data/foro.db`, por ejemplo con `sqlite3 data/foro.db ".backup copia.db"`.
- [ ] **Aviso legal y política de privacidad** (LSSI y RGPD): son obligatorios al abrir el registro al público en España, porque la web guarda nombre de usuario, correo y mensajes. Deben incluir quién es el responsable, con nombre y contacto, y no se pueden inventar: redáctalos con tus datos o con un servicio especializado.
- [ ] Comprobar que la marca «Monibas Capital» está libre en la OEPM (España) y la EUIPO (UE) antes de invertir en ella.
- [ ] Probar el registro, un test, el foro y el consultor en el dominio final, desde el móvil y el ordenador.
- [ ] Si activas Premium: claves de Stripe en modo real, webhook apuntando al dominio final, `PUBLIC_URL` correcta, portal de clientes activado, una compra y una cancelación de prueba, y **condiciones de contratación** publicadas (apartado 6).

## 9. Mantenimiento

- **Textos:** todo está en `public/locales/`. Si cambias un texto, cámbialo en los 4 idiomas; `npm run check` avisa si falta alguna clave o si no coinciden los marcadores `{n}`.
- **Nuevas preguntas:** cada nivel necesita 8 preguntas con 4 opciones, y la respuesta correcta debe estar en la misma posición en todos los idiomas. El comprobador lo verifica.
- **Contenido Premium:** está en `premium/*.json` (mismas reglas: 8 preguntas por módulo, respuestas en la misma posición en los 4 idiomas). Tras cambiarlo, reinicia el servidor: lo carga al arrancar.
- **Dependencias:** ejecuta `npm outdated` y `npm audit` cada pocos meses.

## 10. Límites conocidos (pendientes para una versión futura)

- **No hay verificación de correo ni recuperación de contraseña**: ambas necesitan un servicio de envío de correos (por ejemplo, Postmark o Amazon SES).
- **El bloqueo por cuenta tiene una contrapartida**: alguien que conozca tu correo puede bloquear tu acceso durante 15 minutos a base de intentos fallidos. Es el equilibrio habitual frente al robo de cuentas.
