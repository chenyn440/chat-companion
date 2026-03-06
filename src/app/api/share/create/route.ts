import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Share from '@/models/Share';
import { nanoid } from 'nanoid';

// POST /api/share/create
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const { sessionId, title, messages, userId } = await req.json();

    if (!sessionId || !messages?.length) {
      return Response.json({ success: false, error: '参数错误' }, { status: 400 });
    }

    // 同一会话已有 active 分享则复用
    const existing = await Share.findOne({ sessionId, status: 'active' });
    if (existing) {
      const shareUrl = `${getBaseUrl(req)}/share/${existing.shareId}`;
      return Response.json({ success: true, shareId: existing.shareId, shareUrl });
    }

    // 生成不可枚举 shareId（21位随机字符）
    const shareId = nanoid(21);
    await Share.create({
      shareId,
      sessionId,
      title: title || '对话分享',
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
        timestamp: m.createdAt ? new Date(m.createdAt) : new Date(),
      })),
      createdBy: userId || null,
      status: 'active',
      createdAt: Date.now(),
    });

    const shareUrl = `${getBaseUrl(req)}/share/${shareId}`;
    return Response.json({ success: true, shareId, shareUrl });
  } catch (err: any) {
    console.error('Share create error:', err);
    return Response.json({ success: false, error: '创建分享失败' }, { status: 500 });
  }
}

function getBaseUrl(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3002';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}
