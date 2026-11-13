import http from 'http';
import app from './src/app.js';
import connectDB from './src/config/db.js';
import mongoose from 'mongoose';
import { initSocket } from './src/socket/socket.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Create HTTP Server & Initialize WebSockets
    const httpServer = http.createServer(app);
    initSocket(httpServer);

    // 3. Start Listening on all interfaces (IPv4/IPv6 & localhost)
    const server = httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Meeraco CRM Backend running on http://localhost:${PORT}`);
      console.log(`📡 API Endpoints available at http://localhost:${PORT}/api/v1`);
      console.log(`⚡ WebSocket Server active on ws://localhost:${PORT}`);
      console.log(`🩺 Health check at http://localhost:${PORT}/api/v1/health`);
    });

    // Graceful Shutdown
    const shutdown = async () => {
      console.log('\nStopping server gracefully...');
      server.close(async () => {
        await mongoose.disconnect();
        console.log('MongoDB disconnected. Exiting.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('❌ Server startup error:', error);
    process.exit(1);
  }
}

startServer();
