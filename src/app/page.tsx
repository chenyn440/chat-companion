'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/authStore';
import { ArrowRight, MessageCircle, Zap, Shield, Sparkles, Heart, Brain, Star } from 'lucide-react';

const EXAMPLES = [
  { category: '情感', text: '最近压力很大，感觉很迷茫，不知道该怎么办…', emoji: '💙' },
  { category: '职场', text: '和同事关系有点紧张，怎么改善工作中的沟通？', emoji: '💼' },
  { category: '生活', text: '今天发生了一件让我很开心的事，想和你分享', emoji: '✨' },
  { category: '成长', text: '我想养成早起的习惯，但总是坚持不下去', emoji: '🌱' },
  { category: '倾诉', text: '失眠了，脑子里乱七八糟的，能陪我聊聊吗？', emoji: '🌙' },
  { category: '思考', text: '如果你可以实现一个愿望，你会选择什么？', emoji: '🌟' },
];

const FEATURES = [
  { icon: <Heart size={22} className="text-pink-500" />, title: '真诚陪伴', desc: '随时在线，不评判，不说教，只是陪着你' },
  { icon: <Brain size={22} className="text-violet-500" />, title: '深度理解', desc: '记忆你的上下文，像朋友一样理解你的处境' },
  { icon: <Zap size={22} className="text-amber-500" />, title: '即时响应', desc: '秒级回复，不让你在等待中更焦虑' },
  { icon: <Shield size={22} className="text-green-500" />, title: '隐私安全', desc: '你的倾诉只属于你，对话数据安全可控' },
  { icon: <Sparkles size={22} className="text-blue-500" />, title: '多种角色', desc: '知心朋友、职场导师、生活教练，随你切换' },
  { icon: <Star size={22} className="text-orange-500" />, title: '记录收藏', desc: '珍贵对话可收藏、可分享，留住每一份温度' },
];

export default function LandingPage() {
  const router = useRouter();
  const { user, isLoggedIn, checkAuth } = useAuthStore();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkAuth().finally(() => setAuthChecked(true));
  }, []);

  const handleExample = (prompt: string) => {
    router.push(`/chat-v2?prompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* ===== 顶部导航 ===== */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-gray-900">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <MessageCircle size={16} className="text-white" />
            </div>
            AI 陪聊
          </Link>
          <div className="flex items-center gap-3">
            {authChecked && (
              isLoggedIn && user ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center text-white text-xs font-bold">
                      {user.nickname.slice(0, 1).toUpperCase()}
                    </div>
                    <span className="hidden sm:inline">{user.nickname}</span>
                  </div>
                  <Link
                    href="/chat-v2"
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    进入对话 <ArrowRight size={14} />
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                    登录
                  </Link>
                  <Link
                    href="/chat-v2"
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
                  >
                    开始对话 <ArrowRight size={14} />
                  </Link>
                </>
              )
            )}
          </div>
        </div>
      </header>

      {/* ===== Hero 首屏 ===== */}
      <section className="pt-36 pb-24 px-5">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 text-sm px-4 py-1.5 rounded-full mb-6 font-medium">
            <Sparkles size={14} />
            随时在线的 AI 倾听者
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight mb-6">
            你说，我听<br />
            <span className="bg-gradient-to-r from-blue-500 to-violet-600 bg-clip-text text-transparent">
              不孤单，不评判
            </span>
          </h1>
          <p className="text-xl text-gray-500 leading-relaxed mb-10 max-w-xl mx-auto">
            情绪低落时、迷茫困惑时、想分享一件小事时<br />
            AI 陪聊随时在，真诚倾听，陪你思考
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/chat-v2"
              className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 text-base"
            >
              立即开始对话 <ArrowRight size={16} />
            </Link>
            <a
              href="#examples"
              className="flex items-center gap-2 px-8 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-2xl transition-colors text-base"
            >
              查看示例
            </a>
          </div>
        </div>
      </section>

      {/* ===== 示例 Prompt 区 ===== */}
      <section id="examples" className="py-16 px-5 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">不知从何开始？试试这些</h2>
            <p className="text-gray-500">点击任意话题，直接带入对话框</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => handleExample(ex.text)}
                className="text-left p-5 bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md hover:shadow-blue-50 transition-all group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{ex.emoji}</span>
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {ex.category}
                  </span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed group-hover:text-gray-900 transition-colors">
                  {ex.text}
                </p>
                <div className="mt-3 flex items-center gap-1 text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>点击使用</span> <ArrowRight size={11} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 特点/卖点区 ===== */}
      <section className="py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">为什么选择 AI 陪聊</h2>
            <p className="text-gray-500">不只是聊天工具，更像一个懂你的朋友</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="p-6 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 底部 CTA ===== */}
      <section className="py-20 px-5 bg-gradient-to-br from-blue-600 to-violet-700">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">现在就开始聊聊吧</h2>
          <p className="text-blue-100 mb-8 text-lg">无需注册，即刻使用，随时随地的倾诉空间</p>
          <Link
            href="/chat-v2"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white hover:bg-gray-50 text-blue-600 font-bold rounded-2xl transition-colors shadow-lg text-base"
          >
            立即开始对话 <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ===== 页脚 ===== */}
      <footer className="py-8 px-5 border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <MessageCircle size={12} className="text-white" />
            </div>
            <span className="font-medium text-gray-600">AI 陪聊</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#" className="hover:text-gray-600 transition-colors">隐私政策</a>
            <a href="#" className="hover:text-gray-600 transition-colors">服务条款</a>
            <a href="#" className="hover:text-gray-600 transition-colors">联系我们</a>
          </div>
          <p>© 2026 AI 陪聊</p>
        </div>
      </footer>

      {/* 移动端底部固定 CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 sm:hidden z-40">
        <Link
          href="/chat-v2"
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-blue-600 text-white font-semibold rounded-2xl"
        >
          立即开始对话 <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
