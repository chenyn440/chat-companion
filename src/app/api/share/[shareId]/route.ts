import { NextRequest } from 'next/server';
import dbConnect from '@/lib/db/mongoose';
import Share from '@/models/Share';

// GET /api/share/[shareId]
export async function GET(_: NextRequest, { params }: { params: Promise<{ shareId: string }> }) {
  try {
    await dbConnect();
    const { shareId } = await params;
    const share = await Share.findOne({ shareId });

    if (!share) {
      return Response.json({ success: false, error: '分享不存在' }, { status: 404 });
    }
    if (share.status === 'revoked') {
      return Response.json({ success: false, error: '链接已失效' }, { status: 410 });
    }

    return Response.json({
      success: true,
      data: {
        shareId: share.shareId,
        title: share.title,
        messages: share.messages,
        createdAt: share.createdAt,
      },
    });
  } catch (err) {
    console.error('Share get error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// POST /api/share/[shareId] - revoke
export async function POST(_: NextRequest, { params }: { params: Promise<{ shareId: string }> }) {
  try {
    await dbConnect();
    const { shareId } = await params;
    const share = await Share.findOne({ shareId });
    if (!share) {
      return Response.json({ success: false, error: '分享不存在' }, { status: 404 });
    }
    share.status = 'revoked';
    await share.save();
    return Response.json({ success: true });
  } catch (err) {
    console.error('Share revoke error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
