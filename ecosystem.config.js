module.exports = {
  apps: [
    {
      name: "chat-companion", // 项目名称
      script: "node_modules/next/dist/bin/next", // Next 启动脚本
      cwd: "/home/chat-companion",  // 核对这个路径是否正确
      args: "start", // 启动参数
      instances: "max", // 开启多进程（根据服务器核数）
      autorestart: true, // 崩溃自动重启
      watch: false, // 生产环境关闭监听
      max_memory_restart: "1G", // 内存占用超 1G 重启
      env: {
        GROQ_API_KEY: "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",
        NODE_ENV: "production", // 生产环境
        PORT: 3000, // 项目端口
        MONGODB_URI: "mongodb://admin:Admin%402024@127.0.0.1:27017/chat-companion?authSource=admin", //"mongodb://admin:Admin@2024@127.0.0.1:27017/chat-companion?authSource=admin",
        ZHIPU_API_KEY: "3706a148fc5547428f54bde48dcddc4a.mejmUYR37w93vill"
      },
    },
  ],
};
