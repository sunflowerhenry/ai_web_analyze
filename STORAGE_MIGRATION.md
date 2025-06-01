# 存储架构迁移说明

## 问题背景

原系统存在以下问题：
1. **QuotaExceededError**: 浏览器 localStorage 存储配额限制（5-10MB），无法处理大量分析数据
2. **性能问题**: 大量数据存储在前端，导致页面加载缓慢和内存占用过高
3. **数据丢失风险**: 浏览器清理 localStorage 会导致所有分析数据丢失

## 解决方案

### 新的混合存储架构

**前端存储（localStorage）**:
- AI配置信息（API密钥、模型设置等）
- 用户偏好设置
- 临时状态信息

**服务端存储（文件系统）**:
- 分析结果数据
- URL列表
- 爬取内容
- 公司信息和邮箱数据

### 核心改进

#### 1. 分离存储逻辑
```typescript
// 配置存储（本地）
export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      config: defaultConfig,
      updateConfig: (newConfig) => set((state) => ({
        config: { ...state.config, ...newConfig }
      })),
    }),
    {
      name: 'ai-analysis-config',  // 只存储配置
      version: 1,
    }
  )
)

// 数据存储（服务端API）
export const useAnalysisStore = create<DataState>((set, get) => ({
  analysisData: [],
  loadAnalysisData: async (page = 1, limit = 100) => {
    const response = await fetch(`/api/analysis-data?page=${page}&limit=${limit}`)
    const data = await response.json()
    set({ 
      analysisData: data.results || [],
      totalCount: data.total || 0,
      currentPage: page
    })
  },
  // ... 其他异步方法
}))
```

#### 2. 服务端API路由

**主要API端点**:
- `GET /api/analysis-data` - 分页获取分析数据
- `POST /api/analysis-data` - 添加新URL
- `PATCH /api/analysis-data/[id]` - 更新单个分析结果
- `DELETE /api/analysis-data` - 删除数据

**数据存储**:
- 位置: `./data/analysis-results.json`
- 格式: JSON文件
- 特性: 
  - 自动清理7天前的过期数据
  - 限制总数据量到10000条
  - 内容长度优化（限制到2000字符）

#### 3. 分页和筛选优化

**服务端分页**:
- 默认每页100条记录
- 支持页码导航
- 显示总数和当前范围

**本地筛选**:
- 在当前页数据上应用筛选
- 搜索功能（URL、公司名称、原因）
- 状态和结果筛选

#### 4. 内存和性能优化

**内容存储优化**:
```typescript
// 优化存储，限制内容长度
const optimizedUpdate = { ...updateData }
if (updateData.crawledContent) {
  optimizedUpdate.crawledContent = {
    title: updateData.crawledContent.title,
    description: updateData.crawledContent.description,
    content: updateData.crawledContent.content?.substring(0, 2000),
    pages: undefined // 不存储pages数组，太占空间
  }
}
```

**自动数据清理**:
- 7天数据保留期
- 定期清理过期数据
- 限制最大数据量

## 使用说明

### 数据持久化
- **配置信息**: 自动保存在浏览器本地，清除浏览器数据会丢失
- **分析数据**: 保存在服务器文件系统，重启浏览器或刷新页面不会丢失

### 分页操作
- 使用底部分页控件切换页面
- 每页固定显示100条记录
- 支持跳转到指定页面

### 筛选功能
- 搜索和筛选仅在当前页数据上生效
- 如需全局搜索，需要遍历所有页面
- 清除筛选条件可查看完整的当前页数据

### 数据刷新
- 点击刷新按钮可重新加载当前页数据
- 后台任务完成后会自动同步结果
- 支持实时状态更新

## 技术优势

1. **突破存储限制**: 不再受浏览器localStorage 5-10MB限制
2. **提升性能**: 前端只保存当前页数据，减少内存占用
3. **数据安全**: 服务端存储，不会因浏览器清理而丢失
4. **扩展性强**: 支持10000+ URL处理，可轻松扩展
5. **实时同步**: 前后端数据实时同步，多标签页数据一致

## 迁移影响

### 向后兼容性
- 旧版本的localStorage数据会被保留作为配置
- 新系统会自动初始化空的分析数据
- 用户需要重新添加URL进行分析

### 性能改善
- 页面加载速度显著提升
- 支持大规模数据处理（10000+ URLs）
- 减少浏览器内存使用

### 用户体验
- 配置信息保持不变
- 数据操作变为异步，有loading状态提示
- 支持更强大的分页和筛选功能

## 后续优化建议

1. **数据库存储**: 可考虑使用SQLite或其他数据库替代JSON文件
2. **云存储集成**: 支持云端数据备份和恢复
3. **多用户支持**: 添加用户身份验证和数据隔离
4. **缓存优化**: 实现Redis缓存提升查询性能
5. **数据导入导出**: 支持批量数据迁移功能 