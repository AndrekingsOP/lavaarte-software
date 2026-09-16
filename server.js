const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let qrCodeData = null;
let clientReady = false;

// Cliente WhatsApp con autenticación local persistente
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './wwebjs_auth' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  }
});

client.on('qr', (qr) => {
  qrcode.toDataURL(qr, (err, url) => {
    if (!err) qrCodeData = url;
  });
});

client.on('ready', () => {
  console.log('✅ WhatsApp conectado y listo para enviar recibos.');
  clientReady = true;
  qrCodeData = null;
});

client.on('disconnected', () => {
  console.log('⚠️ WhatsApp desconectado. Reiniciando cliente...');
  clientReady = false;
  client.initialize();
});

client.initialize();

// Ruta para escanear el QR desde el navegador
app.get('/whatsapp-qr', (req, res) => {
  if (clientReady) {
    return res.send(`
      <div style="text-align:center; padding:50px; font-family:sans-serif;">
        <h2 style="color:green;">✅ WhatsApp ya está vinculado y en línea.</h2>
        <p>Los recibos se enviarán automáticamente desde tu número.</p>
      </div>
    `);
  }
  if (!qrCodeData) {
    return res.send(`
      <div style="text-align:center; padding:50px; font-family:sans-serif;">
        <h2>⏳ Generando código QR...</h2>
        <p>Por favor recarga esta página en 5 segundos.</p>
      </div>
    `);
  }
  res.send(`
    <div style="text-align:center; padding:30px; font-family:sans-serif;">
      <h2>Escanea este QR con tu WhatsApp:</h2>
      <img src="${qrCodeData}" style="border:1px solid #ccc; padding:10px; border-radius:8px;" />
      <p>Abre WhatsApp en tu teléfono > Dispositivos vinculados > Vincular un dispositivo</p>
    </div>
  `);
});

// Endpoint para envío de comprobantes en segundo plano
app.post('/api/enviar-recibo', async (req, res) => {
  const { telefono, mensaje } = req.body;
  if (!clientReady) {
    return res.status(503).json({ ok: false, error: 'Servicio de WhatsApp no listo' });
  }

  try {
    const cleanTel = telefono.replace(/\D/g, '');
    const chatId = `57${cleanTel}@c.us`;
    await client.sendMessage(chatId, mensaje);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error enviando mensaje:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Lavaarte OS corriendo en el puerto ${PORT}`);
});
