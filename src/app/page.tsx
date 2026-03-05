import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💬</span>
            <span className="text-xl font-bold text-gray-800">AI 陪聊</span>
          </div>
          <Link
            href="/login"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            开始使用
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
            随时随地的
            <span className="text-blue-600">贴心陪伴</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            无论是情感倾诉、职场困惑还是生活建议，
            <br />
            这里总有懂你的朋友在等你。
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition text-lg font-medium"
            >
              开始聊天
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition text-lg font-medium"
            >
              了解更多
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">三种角色，满足你的不同需求</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="text-4xl mb-4">😊</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">知心朋友</h3>
            <p className="text-gray-600">温暖、倾听、共情，像老朋友一样陪伴你，给你情感支持。</p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="text-4xl mb-4">💼</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">职场导师</h3>
            <p className="text-gray-600">专业、理性、建设性，帮你规划职业发展，解决工作难题。</p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition">
            <div className="text-4xl mb-4">🏠</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">生活顾问</h3>
            <p className="text-gray-600">实用、周到、有条理，帮你打理日常生活，做出更好决策。</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-blue-600 rounded-3xl p-12 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">准备好开始了吗？</h2>
          <p className="text-blue-100 mb-8 text-lg">现在注册，立即体验 AI 陪伴的温暖</p>
          <Link
            href="/login"
            className="inline-block px-8 py-4 bg-white text-blue-600 rounded-xl hover:bg-gray-100 transition text-lg font-medium"
          >
            免费开始使用
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500">
          <p>© 2026 AI 陪聊. 让科技更有温度.</p>
        </div>
      </footer>
    </div>
  );
}
