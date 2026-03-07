import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import mongoose from 'mongoose';

// 通话信令 Schema（内存级，TTL 5分钟自动清理）
const CallSignalSchema = new mongoose.Schema({
  conversationId: { type: String, required: true },
  fromUserId:     { type: String, required: true },
  toUserId:       { type: String, required: true },
  type:           { type: String, required: true }, // offer | answer | reject | end | ice-candidate
  payload:        { type: String, default: '' },    // JSON string
  createdAt:      { type: Number, default: () => Date.now() },
});

if (mongoose.models.CallSignal) delete (mongoose.models as any).CallSignal;
const CallSignal = mongoose.model('CallSignal', CallSignalSchema);

// POST /api/dm/call - 发送信令
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const userId = req.headers.get('x-user-id');
    if (!userId) return Response.json({ success: false, error: '未登录' }, { status: 401 });

    const { conversationId, toUserId, type, payload } = await req.json();
    if (!conversationId || !toUserId || !type) {
      return Response.json({ success: false, error: '参数缺失' }, { status: 400 });
    }

    // 清理 5 分钟前的旧信令
    await CallSignal.deleteMany({ createdAt: { $lt: Date.now() - 5 * 60 * 1000 } });

    // 如果是 offer，先清掉该会话旧的 offer（避免重复呼叫）
    if (type === 'offer') {
      await CallSignal.deleteMany({ conversationId, type: 'offer' });
    }

    const signal = await CallSignal.create({
      conversationId,
      fromUserId: userId,
      toUserId,
      type,
      payload: payload ? JSON.stringify(payload) : '',
    });

    return Response.json({ success: true, data: { id: String(signal._id) } });
  } catch (err) {
    console.error(err);
    return Response.json({ success: false, error: '信令发送失败' }, { status: 500 });
  }
}

// GET /api/dm/call?conversationId=xxx&after=ts - 拉取信令
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const userId = req.headers.get('x-user-id');
    if (!userId) return Response.json({ success: false, error: '未登录' }, { status: 401 });

    const conversationId = req.nextUrl.searchParams.get('conversationId');
    const after = Number(req.nextUrl.searchParams.get('after') || 0);
    if (!conversationId) return Response.json({ success: false, error: '缺少 conversationId' }, { status: 400 });

    const query: any = {
      conversationId,
      toUserId: userId,
      createdAt: { $gt: after || Date.now() - 60 * 1000 }, // 最多拉最近 1 分钟
    };

    const signals = await CallSignal.find(query).sort({ createdAt: 1 }).limit(20);

    // 拉完就删（一次性消费）
    if (signals.length > 0) {
      await CallSignal.deleteMany({ _id: { $in: signals.map(s => s._id) } });
    }

    return Response.json({
      success: true,
      data: signals.map(s => ({
        id: String(s._id),
        fromUserId: s.fromUserId,
        type: s.type,
        payload: s.payload ? JSON.parse(s.payload) : null,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ success: false, error: '拉取信令失败' }, { status: 500 });
  }
}
