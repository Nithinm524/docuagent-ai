/**
 * Production Full-Stack Server
 * AI Document Review & Routing Agent
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import api from './server/api.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Mount API handlers
app.use(api);

// Static files from Vite public folder and dist build output
const publicPath = path.join(__dirname, 'public');
const distPath = path.join(__dirname, 'dist');
app.use(express.static(publicPath));
app.use(express.static(distPath));

// SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Startup configuration validation
console.log('[Server] Initializing DOCUAGENT AI full-stack server...');
console.log(`[Config] Port: ${PORT}`);
console.log(`[Config] Node Environment: ${process.env.NODE_ENV || 'production'}`);
console.log(`[Config] Gemini Vision API: ${process.env.GEMINI_API_KEY ? 'Configured (Multimodal active)' : 'Not set (Deterministic local OCR engine active)'}`);
console.log(`[Config] Force HTTPS: ${process.env.FORCE_HTTPS === 'true' ? 'Enabled' : 'Disabled (Default)'}`);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Listening on http://0.0.0.0:${PORT}`);
});

