'use strict';
/**
 * Da o retira Premium a mano (regalos, pruebas, colaboradores o atención al cliente), sin pasar por Stripe.
 *   npm run grant-premium -- correo@ejemplo.com 30         → 30 días de Premium
 *   npm run grant-premium -- correo@ejemplo.com --remove   → lo retira
 * Se ejecuta en el propio servidor: solo puede usarlo quien tenga acceso a él.
 * Ojo: si esa persona tiene una suscripción de Stripe activa, la próxima renovación volverá a fijar su fecha.
 */
require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');

const email = String(process.argv[2] || '').trim().toLowerCase();
const remove = process.argv.includes('--remove');
const days = parseInt(process.argv[3], 10);
if (!email.includes('@') || (!remove && !(days > 0 && days <= 3650))) {
  console.error('Uso: npm run grant-premium -- correo@ejemplo.com <días>   o   npm run grant-premium -- correo@ejemplo.com --remove');
  process.exit(1);
}
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const db = new Database(path.join(dataDir, 'foro.db'), { fileMustExist: true });
if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'premium_until')) {
  console.error('Arranca el servidor una vez (npm start) para actualizar la base de datos y vuelve a intentarlo.');
  process.exit(1);
}
const user = db.prepare('SELECT id, username FROM users WHERE email = ?').get(email);
if (!user) { console.error('No hay ninguna cuenta con ese correo.'); process.exit(1); }
const until = remove ? 0 : Date.now() + days * 24 * 3600 * 1000;
db.prepare('UPDATE users SET premium_until = ? WHERE id = ?').run(until, user.id);
console.log(remove ? `«${user.username}» ya no tiene Premium.` : `«${user.username}» tiene Premium hasta el ${new Date(until).toLocaleDateString('es-ES')}.`);
db.close();
