import { Server } from 'socket.io';

let io = null;

/**
 * Initialize Socket.IO with HTTP Server
 */
export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });

  io.on('connection', (socket) => {
    // Client can authenticate on connection or emit 'join'
    const query = socket.handshake.query || {};
    const auth = socket.handshake.auth || {};

    const userId = auth.userId || query.userId;
    const roleId = auth.roleId || query.roleId;
    const roleName = auth.roleName || query.roleName;
    const branchId = auth.branchId || query.branchId;

    if (userId) socket.join(`user:${userId}`);
    if (roleId) socket.join(`role:${roleId}`);
    if (roleName) {
      socket.join(`role_name:${roleName.trim().toLowerCase()}`);
    }
    if (branchId) socket.join(`branch:${branchId}`);
    socket.join('broadcast');

    console.log(`🔌 Socket connected: ${socket.id} (User: ${userId || 'guest'}, Role: ${roleName || roleId || 'none'})`);

    // Dynamic join event
    socket.on('join_rooms', (data = {}) => {
      if (data.userId) socket.join(`user:${data.userId}`);
      if (data.roleId) socket.join(`role:${data.roleId}`);
      if (data.roleName) socket.join(`role_name:${data.roleName.trim().toLowerCase()}`);
      if (data.branchId) socket.join(`branch:${data.branchId}`);
    });

    socket.on('disconnect', () => {
      // disconnected
    });
  });

  console.log('⚡ Socket.IO initialized successfully');
  return io;
};

/**
 * Get Socket.IO Instance
 */
export const getIO = () => io;

/**
 * Emit Role Permissions Updated
 * Instant real-time permission sync without page refresh!
 */
export const emitRolePermissionsUpdated = (role) => {
  if (!io || !role) return;
  const roleId = String(role.id || role._id || '');
  const roleName = (role.name || '').trim().toLowerCase();

  const payload = {
    id: roleId,
    _id: roleId,
    name: role.name,
    simplifiedPermissions: role.simplifiedPermissions || {},
    permissionsList: role.permissionsList || [],
    matrix: role.matrix || {},
    updatedAt: new Date().toISOString()
  };

  // Broadcast to all clients and specific role channels
  io.emit('role:permissions_updated', payload);
  if (roleId) io.to(`role:${roleId}`).emit('role:permissions_updated', payload);
  if (roleName) io.to(`role_name:${roleName}`).emit('role:permissions_updated', payload);

  console.log(`📢 [Socket] Broadcasted role:permissions_updated for '${role.name}'`);
};

/**
 * Emit Lead Events
 */
export const emitLeadCreated = (lead) => {
  if (!io || !lead) return;
  io.emit('lead:created', lead);
  if (lead.branchId) io.to(`branch:${lead.branchId}`).emit('lead:created', lead);
  if (lead.assignedToId) io.to(`user:${lead.assignedToId}`).emit('lead:assigned', lead);
};

export const emitLeadUpdated = (lead) => {
  if (!io || !lead) return;
  io.emit('lead:updated', lead);
  if (lead.branchId) io.to(`branch:${lead.branchId}`).emit('lead:updated', lead);
  if (lead.assignedToId) io.to(`user:${lead.assignedToId}`).emit('lead:assigned', lead);
};

/**
 * Emit Customer Created
 */
export const emitCustomerCreated = (customer) => {
  if (!io || !customer) return;
  io.emit('customer:created', customer);
};

