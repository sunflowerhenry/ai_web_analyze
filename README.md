# Customer Analysis - 网站客户分析工具

一个智能的网站分析工具，帮助你快速判断网站是否为目标客户，并提取关键信息如公司信息和邮箱地址。

## ✨ 最新更新 (2025-01)

### 🔒 安全性重大改进
- **✅ 修复密钥泄露问题**: 清理了所有敏感数据，添加自动化清理脚本
- **✅ 生产环境安全**: 实现环境分离存储策略（开发环境文件存储，生产环境内存存储）
- **✅ 数据隔离**: 生产环境数据不会持久化，重启后自动清空
- **✅ API密钥保护**: 密钥仅存储在用户浏览器本地，服务器不保存

### 🚀 功能性改进
- **✅ 后台任务功能**: 支持大批量URL分析（>50个自动转后台任务）
- **✅ 进度监控**: 实时显示分析进度，支持后台任务监控
- **✅ 失败数据管理**: 改为手动刷新模式，减少资源消耗
- **✅ 部署优化**: 修复部署后的URL管理功能问题

### 🛠️ 技术改进
- **✅ 存储架构重构**: 实现双模式存储（开发/生产环境）
- **✅ API路由优化**: 统一数据访问层，支持内存和文件存储
- **✅ 自动化脚本**: 提供敏感数据清理和部署初始化脚本
- **✅ 构建优化**: 改进生产环境构建流程

## 🎯 核心功能

### 🔍 智能网站分析
- **AI驱动判断**: 使用OpenAI GPT模型智能判断网站是否为目标客户
- **批量处理**: 支持批量导入URL，一键分析
- **后台任务**: 大批量数据自动转为后台任务，关闭网页也继续运行

### 📊 数据提取
- **公司信息提取**: 自动提取公司名称、创始人信息、品牌名称
- **邮箱信息挖掘**: 智能提取联系邮箱和负责人信息
- **详细分析报告**: 提供判断依据和详细分析结果

### ⚡ 高效工作流
- **实时进度监控**: 显示分析进度和当前处理状态
- **灵活导出**: 支持Excel、CSV、JSON格式导出
- **数据管理**: 支持筛选、搜索、分页浏览结果

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 或 yarn

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd Customer-Analysis
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境**
```bash
cp .env.example .env
# 编辑 .env 文件，添加必要的配置
```

4. **启动开发服务器**
```bash
npm run dev
```

5. **访问应用**
打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 🔧 配置说明

### API密钥配置
1. 访问 [OpenAI API](https://platform.openai.com/api-keys) 获取API密钥
2. 在应用中的"配置"页面输入你的API密钥
3. 密钥将安全地存储在浏览器本地存储中

### 高级配置
- **并发设置**: 调整同时处理的URL数量
- **代理配置**: 配置代理服务器（如需要）
- **反检测设置**: 启用随机User-Agent等反检测功能

## 📦 部署

### 生产环境部署

1. **预部署准备**
```bash
npm run build-production
```

2. **部署到Vercel**
```bash
vercel --prod
```

3. **环境变量设置**
在部署平台设置以下环境变量：
```env
NODE_ENV=production
DISABLE_FILE_STORAGE=true
MAX_STORAGE_ITEMS=1000
DATA_EXPIRY_DAYS=1
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_DEMO_MODE=true
```

### 安全注意事项
- 生产环境使用内存存储，数据不会持久化
- API密钥仅存储在用户浏览器本地
- 服务器不会保存任何敏感信息
- 建议定期重启应用以清理内存

详细部署说明请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 🛠️ 开发

### 项目结构
```
src/
├── app/                 # Next.js App Router
│   ├── api/            # API路由
│   ├── config/         # 配置页面
│   └── page.tsx        # 主页面
├── components/         # React组件
│   ├── ui/            # UI组件库
│   ├── analysis-table.tsx
│   ├── url-input.tsx
│   └── ...
└── store/             # 状态管理
    └── analysis-store.ts
```

### 开发脚本
```bash
npm run dev              # 启动开发服务器
npm run build            # 构建生产版本
npm run build-production # 安全构建（清理敏感数据）
npm run clean-sensitive  # 清理敏感数据
npm run security-check   # 安全检查
npm run deploy-init      # 部署初始化
```

### 技术栈
- **前端**: Next.js 15, React 19, TypeScript
- **UI**: Tailwind CSS, Radix UI, Lucide Icons
- **状态管理**: Zustand
- **数据处理**: Axios, Cheerio
- **导出功能**: XLSX, CSV
- **AI集成**: OpenAI GPT API

## 🔒 安全特性

### 数据保护
- **零持久化**: 生产环境不保存用户数据到磁盘
- **本地密钥**: API密钥仅存储在浏览器本地
- **自动清理**: 提供多种敏感数据清理工具
- **安全头**: 生产环境自动添加安全HTTP头

### 隐私保护
- **内存存储**: 生产环境数据存储在内存中
- **会话隔离**: 每个用户会话独立，数据不共享
- **定期清理**: 建议定期重启应用清理内存

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目！

### 开发指南
1. Fork 这个仓库
2. 创建你的功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个Pull Request

## 📄 许可证

这个项目使用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🆘 支持

如果你遇到任何问题：

1. 查看 [DEPLOYMENT.md](./DEPLOYMENT.md) 中的故障排除部分
2. 检查 [Issues](../../issues) 中是否有类似问题
3. 创建新的Issue描述你的问题

## 📊 更新日志

### v1.2.0 (2025-01)
- 🔒 重大安全更新：修复密钥泄露问题
- 🚀 新增后台任务功能
- ✨ 改进数据存储架构
- 🛠️ 优化部署流程

### v1.1.0 (2024-12)
- ✨ 添加批量URL分析功能
- 📊 改进数据导出功能
- 🔧 添加高级配置选项

### v1.0.0 (2024-11)
- 🎉 初始版本发布
- 🔍 基础网站分析功能
- 📧 邮箱信息提取功能

---

**开发团队**: [你的团队名称]  
**最后更新**: 2025年1月  
**版本**: v1.2.0

