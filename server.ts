import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import mongoose from 'mongoose';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// 连接 MongoDB（ws 服务器也需要持久化消息）
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-companion';

// conversationId -> Set<WebSocket>
const rooms = new Map<string, Set<WebSocket>>();

function getRoomClients(convId: string): Set<WebSocket> {
  if (!rooms.has(convId)) rooms.set(convId, new Set());
  return rooms.get(convId)!;
}

// 延迟加载 mongoose 模型（等 next 初始化完成）
async function getModels() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
  }
  // 动态 require 避免在 server.ts 编译时出问题
  const { DmConversation, DmMessage } = await import('./src/models/Dm');
  return { DmConversation, DmMessage };
}

app.prepare().then(async () => {
  await mongoose.connect(MONGODB_URI);
  console.log('[server] MongoDB connected');

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  // WebSocket 升级处理
  server.on('upgrade', (req, socket, head) => {
    const { pathname, query } = parse(req.url!, true);
    // ws 路径：/ws/dm/:conversationId?userId=xxx
    if (pathname?.startsWith('/ws/dm/')) {
      const convId = pathname.split('/ws/dm/')[1];
      const userId = query.userId as string;
      if (!convId || !userId) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req, { convId, userId });
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (ws: WebSocket, _req: any, ctx: { convId: string; userId: string }) => {
    const { convId, userId } = ctx;
    console.log(`[ws] connected convId=${convId} userId=${userId}`);

    const clients = getRoomClients(convId);
    clients.add(ws);

    // 发送历史消息（最近 50 条）
    try {
      const { DmConversation, DmMessage } = await getModels();
      const conv = await DmConversation.findById(convId);
      if (!conv || !conv.participants.map(String).includes(userId)) {
        ws.close(4001, 'unauthorized');
        return;
      }

      const history = await DmMessage.find({ conversationId: convId })
        .sort({ createdAt: 1 }).limit(50);

      // 加载用户昵称
      const { default: User } = await import('./src/models/User');
      const senderIds = [...new Set(history.map((m: any) => String(m.senderId)))];
      const users = await User.find({ _id: { $in: senderIds } }).select('_id nickname');
      const userMap = Object.fromEntries(users.map((u: any) => [String(u._id), u.nickname]));

      ws.send(JSON.stringify({
        type: 'history',
        messages: history.map((m: any) => ({
          id: String(m._id),
          senderId: String(m.senderId),
          senderNickname: userMap[String(m.senderId)] || '未知',
          content: m.content,
          createdAt: m.createdAt,
          isSelf: String(m.senderId) === userId,
        })),
      }));
    } catch (err) {
      console.error('[ws] history error', err);
    }

    // 接收消息
    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'send' && msg.content?.trim()) {
          const { DmConversation, DmMessage } = await getModels();
          const { default: User } = await import('./src/models/User');

          const saved = await DmMessage.create({
            conversationId: convId,
            senderId: userId,
            content: msg.content.trim(),
          });

          // 更新会话 lastMessage
          await DmConversation.findByIdAndUpdate(convId, {
            lastMessage: msg.content.trim().slice(0, 50),
            updatedAt: Date.now(),
          });

          const sender = await User.findById(userId).select('nickname');

          const payload = JSON.stringify({
            type: 'message',
            message: {
              id: String(saved._id),
              senderId: userId,
              senderNickname: sender?.nickname || '未知',
              content: saved.content,
              createdAt: saved.createdAt,
            },
          });

          // 广播给房间内所有连接（包括自己，isSelf 由前端判断）
          clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(payload);
            }
          });
        }
      } catch (err) {
        console.error('[ws] message error', err);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      if (clients.size === 0) rooms.delete(convId);
      console.log(`[ws] disconnected convId=${convId} userId=${userId}`);
    });

    ws.on('error', (err) => console.error('[ws] error', err));
  });

  const PORT = process.env.PORT || 3002;
  server.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
});
