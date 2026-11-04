import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/index.js';
import { notFound, serverError } from './helpers/response.helper.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(morgan('dev'));

// Static uploads serving
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// API Routes
app.use('/api/v1', apiRouter);
app.use((req, res) => {
  return notFound(res, `API route '${req.method} ${req.originalUrl}' was not found on this server`);
});

// Standard Global 500 Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  return serverError(res, 'An unexpected server error occurred', err);
});

export default app;
