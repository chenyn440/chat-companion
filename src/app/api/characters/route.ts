import { NextResponse } from 'next/server';
import { CHARACTERS } from '@/lib/config/characters';

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      characters: CHARACTERS.map(({ id, name, avatar, greeting, tags }) => ({
        _id: id,
        name,
        avatar,
        greeting,
        tags,
      })),
    });
  } catch (error) {
    console.error('Get characters error:', error);
    return NextResponse.json(
      { success: false, error: '获取角色失败' },
      { status: 500 }
    );
  }
}
