import type { Server } from 'socket.io';
import { prisma } from '../lib/prisma';

let io: Server | null = null;
export function attachLive(server: Server) {
  io = server;
  const ns = server.of('/live');
  ns.on('connection', (socket) => {
    socket.on('join', async (eventId: string) => { socket.join(`event:${eventId}`); socket.emit('ranking', await rankingFor(eventId)); });
  });
}

export async function rankingFor(eventId: string) {
  const rows = await prisma.eventResult.findMany({ where: { eventId }, orderBy: [{ distanceM: 'desc' }, { timeSec: 'asc' }], include: { user: { select: { nickname: true, avatarColor: true } } }, take: 100 });
  return rows.map((r, i) => ({ rank: i + 1, nickname: r.user.nickname, avatarColor: r.user.avatarColor, timeSec: r.timeSec, distanceM: r.distanceM, updatedAt: r.updatedAt }));
}

export async function broadcastRanking(eventId: string) {
  if (!io) return;
  io.of('/live').to(`event:${eventId}`).emit('ranking', await rankingFor(eventId));
}
