import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import mongoose from 'mongoose';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-companion';

// convId -> Map<userId, WebSocket>（同一用户可能多 tab，取最后一个）
const rooms = new Map<string, Map<string, WebSocket>>();

// 速率限制：userId -> { count, resetAt }
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;         // 每窗口最多消息数
const RATE_WINDOW_MS = 10000;  // 10 秒窗口

function checkRate(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

async function getModels() {
  const { DmConversation, DmMessage } = await import('./src/models/Dm');
  return { DmConversation, DmMessage };
}

// 发送 JSON 事件
function send(ws: WebSocket, type: string, payload: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

app.prepare().then(async () => {
  await mongoose.connect(MONGODB_URI);
  console.log('[server] MongoDB connected');

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (req, socket, head) => {
    const { pathname, query } = parse(req.url!, true);
    if (!pathname?.startsWith('/ws/dm')) { socket.destroy(); return; }

    const userId = query.userId as string;
    if (!userId) { socket.destroy(); return; }

    // 验证用户存在
    try {
      const { default: User } = await import('./src/models/User');
      const user = await User.findById(userId).select('_id');
      if (!user) { socket.destroy(); return; }
    } catch { socket.destroy(); return; }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, { userId });
    });
  });

  wss.on('connection', (ws: WebSocket, _req: any, ctx: { userId: string }) => {
    const { userId } = ctx;
    let joinedConvId: string | null = null;
    console.log(`[ws] connected userId=${userId}`);

    ws.on('message', async (data) => {
      let msg: any;
      try { msg = JSON.parse(data.toString()); } catch { return; }

      // ── dm:join ──────────────────────────────────────────
      if (msg.type === 'dm:join') {
        const { conversationId } = msg;
        if (!conversationId) return;

        try {
          const { DmConversation } = await getModels();
          const conv = await DmConversation.findById(conversationId);
          if (!conv || !conv.participants.map(String).includes(userId)) {
            send(ws, 'dm:error', { code: 4003, message: '无权访问该会话' });
            return;
          }
        } catch {
          send(ws, 'dm:error', { code: 5000, message: '服务器错误' });
          return;
        }

        // 加入房间
        joinedConvId = conversationId;
        if (!rooms.has(conversationId)) rooms.set(conversationId, new Map());
        rooms.get(conversationId)!.set(userId, ws);

        send(ws, 'dm:joined', { conversationId });

        // 拉取历史消息（最近 20 条）
        try {
          const { DmMessage } = await getModels();
          const { default: User } = await import('./src/models/User');
          const history = await DmMessage.find({ conversationId })
            .sort({ createdAt: 1 }).limit(20);

          const senderIds = [...new Set(history.map((m: any) => String(m.senderId)))];
          const users = await User.find({ _id: { $in: senderIds } }).select('_id nickname');
          const userMap = Object.fromEntries(users.map((u: any) => [String(u._id), u.nickname]));

          send(ws, 'dm:history', {
            conversationId,
            messages: history.map((m: any) => ({
              serverMsgId: String(m._id),
              clientMsgId: m.clientMsgId,
              fromUserId: String(m.senderId),
              senderNickname: userMap[String(m.senderId)] || '未知',
              content: m.content,
              createdAt: m.createdAt,
            })),
          });
        } catch (err) {
          console.error('[ws] history error', err);
        }
        return;
      }

      // ── dm:send ──────────────────────────────────────────
      if (msg.type === 'dm:send') {
        if (!joinedConvId) {
          send(ws, 'dm:error', { code: 4001, message: '请先 join 会话' });
          return;
        }

        // 速率限制
        if (!checkRate(userId)) {
          send(ws, 'dm:error', { code: 4029, message: '发送过于频繁，请稍后再试' });
          return;
        }

        const { clientMsgId, content } = msg;
        if (!content?.trim()) return;
        if (content.length > 2000) {
          send(ws, 'dm:error', { code: 4000, message: '消息过长（最多2000字符）' });
          return;
        }

        try {
          const { DmConversation, DmMessage } = await getModels();

          // clientMsgId 幂等处理（去重）
          if (clientMsgId) {
            const existing = await DmMessage.findOne({
              conversationId: joinedConvId,
              clientMsgId,
              senderId: userId,
            });
            if (existing) {
              // 已存在：返回原 ack，前端不重复插入
              send(ws, 'dm:send_ack', {
                conversationId: joinedConvId,
                clientMsgId,
                serverMsgId: String(existing._id),
                createdAt: existing.createdAt,
              });
              return;
            }
          }

          const saved = await DmMessage.create({
            conversationId: joinedConvId,
            senderId: userId,
            content: content.trim(),
            clientMsgId: clientMsgId || null,
          });

          // 更新会话 lastMessage
          await DmConversation.findByIdAndUpdate(joinedConvId, {
            lastMessage: content.trim().slice(0, 50),
            updatedAt: Date.now(),
          });

          const { default: User } = await import('./src/models/User');
          const sender = await User.findById(userId).select('nickname');

          // 发送方 ack
          send(ws, 'dm:send_ack', {
            conversationId: joinedConvId,
            clientMsgId: clientMsgId || null,
            serverMsgId: String(saved._id),
            createdAt: saved.createdAt,
          });

          // 广播给房间内其他成员
          const roomClients = rooms.get(joinedConvId);
          if (roomClients) {
            roomClients.forEach((client, uid) => {
              if (uid !== userId && client.readyState === WebSocket.OPEN) {
                send(client, 'dm:message_new', {
                  conversationId: joinedConvId,
                  serverMsgId: String(saved._id),
                  fromUserId: userId,
                  senderNickname: sender?.nickname || '未知',
                  content: saved.content,
                  createdAt: saved.createdAt,
                });
              }
            });
          }
        } catch (err) {
          console.error('[ws] send error', err);
          send(ws, 'dm:error', { code: 5001, message: '消息保存失败' });
        }
        return;
      }
    });

    ws.on('close', () => {
      if (joinedConvId) {
        rooms.get(joinedConvId)?.delete(userId);
        if (rooms.get(joinedConvId)?.size === 0) rooms.delete(joinedConvId);
      }
      console.log(`[ws] disconnected userId=${userId}`);
    });

    ws.on('error', (err) => console.error('[ws] error', err));
  });

  const PORT = process.env.PORT || 3002;
  server.listen(PORT, () => {
    console.log(`[server] ready on http://localhost:${PORT}`);
  });
});
