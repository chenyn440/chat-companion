# 小暖 - AI 陪聊平台

## 技术栈
- Next.js 14 + TypeScript
- Tailwind CSS
- Zustand (状态管理)
- MongoDB + Mongoose
- Kimi AI API

## 开发环境启动

1. 安装依赖
```bash
npm install
```

2. 配置环境变量
```bash
cp .env.local.example .env.local
# 编辑 .env.local 添加：
# - MongoDB 连接字符串
# - Kimi API Key (从 https://platform.moonshot.cn/ 获取)
```

3. 启动 MongoDB
```bash
# 确保本地 MongoDB 已启动，或使用 MongoDB Atlas
```

4. 启动开发服务器
```bash
npm run dev
```

5. 打开浏览器访问 http://localhost:3000

## 功能特性
- 🤖 Kimi AI 智能陪聊
- 🎭 多种 AI 角色（温柔知心、理性分析、幽默风趣、长辈关怀）
- 💬 多种聊天模式（陪伴、树洞、建议）
- 👤 用户登录系统（手机号 + 验证码）
- 💾 对话历史保存

## 测试登录
- 手机号：任意 11 位数字
- 验证码：123456

## 项目结构
```
src/
├── app/                 # Next.js App Router
│   ├── api/
│   │   ├── auth/login   # 登录接口
│   │   ├── chat/send    # 发送消息
│   │   └── chat/history # 获取历史
├── components/
│   ├── Auth/           # 登录组件
│   └── Chat/           # 聊天组件
├── lib/
│   ├── db/            # 数据库连接
│   ├── services/      # API 服务（Kimi）
│   └── store/         # Zustand 状态管理
├── models/            # MongoDB 模型
└── types/             # TypeScript 类型
```

## 环境变量

```env
MONGODB_URI=mongodb://localhost:27017/chat-companion
KIMI_API_KEY=your_kimi_api_key_here
```
