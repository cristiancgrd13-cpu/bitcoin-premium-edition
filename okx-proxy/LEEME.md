# Puente OKX para Kosmara

La API DEX de OKX permite cobrar comisión en cada swap (hasta un 3 % en redes EVM y un 10 % en Solana, enviada directa a tu wallet), pero exige firmar cada petición con una clave secreta. Esa clave no puede estar en `020.html`, que es pública, así que va en este pequeño servidor gratuito (Cloudflare Workers).

## Pasos

1. **OKX:** entra en el portal de desarrolladores de OKX (web3.okx.com, sección Build / Developer Portal), crea un proyecto y una API key. Apunta la API key, la Secret key y la Passphrase.
2. **Cloudflare:** crea una cuenta gratuita en cloudflare.com → Workers & Pages → Create Worker. Pega el contenido de `worker.js` y despliega.
3. En el Worker, Settings → Variables and Secrets, añade como *secret*: `OKX_API_KEY`, `OKX_SECRET_KEY`, `OKX_PASSPHRASE`, `FEE_EVM_ADDRESS`, `FEE_SOL_ADDRESS`, `FEE_PERCENT` y `ALLOWED_ORIGIN` (la dirección de tu web).
4. Pásale a Claude la URL del Worker (algo como `https://kosmara-okx.<tu-usuario>.workers.dev`) para conectar OKX como tercera ruta en Swap.

Nunca compartas la Secret key ni la Passphrase en el chat: se guardan solo en Cloudflare.
