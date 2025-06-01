# 部署说明

## 🔒 安全修复

### 问题解决
1. ✅ **密钥泄露问题**: 已清理所有数据文件中的敏感信息
2. ✅ **生产环境数据持久化问题**: 生产环境使用内存存储，不会持久化用户数据
3. ✅ **部署后功能问题**: 修复了API路由以支持生产环境

### 安全措施
- 📁 **数据隔离**: 生产环境使用内存存储，开发环境使用文件存储
- 🚫 **防止数据泄露**: .gitignore 已配置忽略所有数据文件
- 🔐 **API密钥保护**: 密钥仅存储在用户浏览器本地
- 🧹 **自动清理**: 提供脚本自动清理敏感数据

## 🚀 部署步骤

### 1. 预部署准备
```bash
# 清理敏感数据和设置生产环境
npm run build-production
```

### 2. 环境变量配置
在部署平台设置以下环境变量：
```env
NODE_ENV=production
DISABLE_FILE_STORAGE=true
MAX_STORAGE_ITEMS=1000
DATA_EXPIRY_DAYS=1
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_DEMO_MODE=true
```

### 3. 部署平台配置

#### Vercel
```bash
vercel --prod
```

#### Netlify
```bash
npm run build
# 部署 .next 目录
```

#### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build-production
EXPOSE 3000
CMD ["npm", "start"]
```

## 🛡️ 安全配置

### 数据存储策略
- **开发环境**: 文件存储 (`data/` 目录)
- **生产环境**: 内存存储 (重启后清空)

### API安全
- ✅ 防止文件系统访问
- ✅ 限制内存存储条目数
- ✅ 设置数据过期时间
- ✅ 添加安全HTTP头

### 用户数据保护
- 🔐 API密钥仅存储在浏览器localStorage
- 📊 分析数据临时存储，会话结束后删除
- 🚫 服务器不会持久化任何敏感信息

## 🔧 维护脚本

### 清理敏感数据
```bash
npm run clean-sensitive
```

### 安全检查
```bash
npm run security-check
```

### 部署初始化
```bash
npm run deploy-init
```

## ⚠️ 重要注意事项

1. **数据丢失**: 生产环境重启后数据会丢失，这是正常的安全设计
2. **内存限制**: 监控内存使用，必要时重启应用
3. **密钥管理**: 用户需要在每次使用时输入API密钥
4. **演示模式**: 生产环境运行在演示模式，不适合长期数据存储

## 📊 监控建议

1. **内存使用**: 监控应用内存使用情况
2. **API调用**: 监控API调用频率和错误率
3. **用户活动**: 记录用户活动但不存储敏感数据
4. **定期重启**: 建议每24小时重启一次应用

## 🆘 故障排除

### 问题: 新浏览器有URL数据
**解决**: 检查是否正确设置了 `NODE_ENV=production`

### 问题: 无法添加/删除URL
**解决**: 确认API路由使用了正确的存储模式

### 问题: 数据持久化
**解决**: 在生产环境中，数据存储在内存中，重启后会丢失（这是预期行为）

---

**最后更新**: $(date)
**版本**: 1.0.0 