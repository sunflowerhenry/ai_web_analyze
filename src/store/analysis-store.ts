import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ProxyConfig {
  host: string
  port: number
  username?: string
  password?: string
  type: 'socks5' | 'http' | 'https'
  status?: 'unknown' | 'working' | 'failed'
  lastChecked?: Date
}

export interface ProxySettings {
  enabled: boolean
  proxies: ProxyConfig[]
  strategy: 'round-robin' | 'concurrent' | 'random'
  maxConcurrentProxies: number
  testUrl: string
}

export interface ConcurrencySettings {
  enabled: boolean
  maxConcurrent: number
  delayBetweenRequests: number
  retryAttempts: number
}

export interface AntiDetectionSettings {
  enabled: boolean
  useHeadlessBrowser: boolean
  randomUserAgent: boolean
  randomDelay: boolean
  minDelay: number
  maxDelay: number
}

export interface AIConfig {
  modelName: string
  apiUrl: string
  apiKey: string
  promptTemplate: string
  companyNamePrompt: string
  emailCrawlPrompt: string
  proxySettings: ProxySettings
  concurrencySettings: ConcurrencySettings
  antiDetectionSettings: AntiDetectionSettings
}

export interface CompanyInfo {
  names: string[]  // 公司名称（按优先级排序）
  founderNames: string[]  // 创始人/老板名称
  brandNames: string[]  // 品牌名称
  fullName: string  // 公司全称
  primaryName: string  // 主要名称（AI选择的最佳名称）
}

export interface EmailInfo {
  email: string
  source: string  // 邮箱来源页面
  ownerName?: string  // 邮箱所有者名称
  type: 'contact' | 'support' | 'sales' | 'info' | 'other'  // 邮箱类型
}

export interface AnalysisResult {
  id: string
  url: string
  result: 'Y' | 'N' | 'PENDING' | 'ERROR'
  reason: string
  companyInfo?: CompanyInfo
  emails?: EmailInfo[]
  status: 'waiting' | 'crawling' | 'analyzing' | 'info-crawling' | 'completed' | 'failed' | 'crawl-failed' | 'analysis-failed' | 'info-crawl-failed'
  crawledContent?: {
    title?: string
    description?: string
    content?: string
    pages?: Array<{
      url: string
      title: string
      content: string
      type: 'home' | 'about' | 'contact' | 'privacy' | 'terms' | 'other'
    }>
  }
  error?: string
  errorDetails?: {
    type: 'crawl_error' | 'ai_error' | 'network_error' | 'timeout_error' | 'config_error' | 'unknown_error'
    stage: 'crawling' | 'ai_analysis' | 'info_extraction' | 'initialization'
    message: string
    statusCode?: number
    retryable: boolean
  }
  createdAt: Date
  updatedAt: Date
  hasInfoCrawled: boolean  // 是否已爬取详细信息
  infoCrawlProgress?: number  // 信息爬取进度
  backgroundTask?: {
    taskId: string
    startedAt: Date
    canRunInBackground: boolean
    priority: 'low' | 'normal' | 'high'
  }
}

// 分离配置存储和数据存储
interface ConfigState {
  config: AIConfig
  updateConfig: (config: Partial<AIConfig>) => void
}

interface DataState {
  // 分析数据现在从服务端获取
  analysisData: AnalysisResult[]
  loadAnalysisData: (page?: number, limit?: number) => Promise<void>
  getAllPendingUrls: () => Promise<string[]>
  addUrls: (urls: string[]) => Promise<boolean>
  updateResult: (id: string, result: Partial<AnalysisResult>) => Promise<void>
  deleteResults: (ids: string[]) => Promise<void>
  clearResults: () => Promise<void>
  
  // 分析状态（保持本地）
  isAnalyzing: boolean
  currentProgress: number
  totalItems: number
  setAnalyzing: (status: boolean) => void
  setProgress: (current: number, total: number) => void
  
  // 后台任务管理
  backgroundTasks: string[]
  addBackgroundTask: (taskId: string) => void
  removeBackgroundTask: (taskId: string) => void
  syncBackgroundTaskResults: (taskId: string) => Promise<void>
  
  // 分页状态
  currentPage: number
  itemsPerPage: number
  totalCount: number
  setPage: (page: number) => void
  setItemsPerPage: (count: number) => void
}

const defaultConfig: AIConfig = {
  modelName: 'gpt-3.5-turbo',
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  proxySettings: {
    enabled: false,
    proxies: [],
    strategy: 'round-robin',
    maxConcurrentProxies: 3,
    testUrl: 'https://httpbin.org/ip'
  },
  concurrencySettings: {
    enabled: false,
    maxConcurrent: 3,
    delayBetweenRequests: 2000,
    retryAttempts: 2
  },
  antiDetectionSettings: {
    enabled: true,
    useHeadlessBrowser: false,
    randomUserAgent: true,
    randomDelay: true,
    minDelay: 1000,
    maxDelay: 3000
  },
  promptTemplate: `请分析以下网站内容，判断这是否是一个目标客户网站。

网站信息：
标题：{title}
描述：{description}
主要内容：{content}
页脚内容：{footerContent}
爬取的页面：{pages}

请根据以下标准进行判断：
1. 是否是企业官网
2. 是否有明确的业务介绍
3. 是否有联系方式
4. 网站内容是否专业完整
5. 是否有明确的公司信息

请以JSON格式回复：
{
  "result": "Y" 或 "N",
  "reason": "详细的判断依据，包括网站类型、业务范围、专业程度等分析"
}`,
  companyNamePrompt: `请从以下网站内容中提取公司相关信息，按优先级排序：

网站内容：
{content}

提取优先级（从高到低）：
1. 邮箱所有者的名称（如果有明确的联系邮箱，优先提取邮箱所有者）
2. 公司创始人或老板的名称
3. 公司的全称名称
4. 公司的品牌名称

注意事项：
- 优先寻找页面中的"关于我们"、"公司简介"、"联系我们"等部分
- 注意识别CEO、创始人、总经理等职位信息
- 从版权信息、备案信息中提取公司名称
- 如果有多个可能的名称，请全部列出

请以JSON格式回复：
{
  "primaryName": "最主要的公司名称",
  "names": ["按优先级排序的所有公司名称"],
  "founderNames": ["创始人/老板名称"],
  "brandNames": ["品牌名称"],
  "fullName": "公司全称（如：XX有限公司）",
  "confidence": "提取信息的可信度(1-10)"
}`,
  emailCrawlPrompt: `请从以下网站内容中提取所有有效的邮箱地址，并识别邮箱所有者：

网站内容：
{content}

要求：
1. 提取所有有效邮箱地址
2. 过滤掉以下无效邮箱：
   - 图片格式邮箱（.png, .jpg, .jpeg, .gif, .webp, .svg等）
   - CDN相关邮箱（包含cdn字样）
   - 测试邮箱（test@, demo@, example@等）
   - 明显的垃圾邮箱
3. 识别邮箱类型（contact, support, sales, info, personal等）
4. 尽可能识别邮箱所有者姓名
5. 标注邮箱来源（页脚、联系页面、关于页面等）

特别注意：
- 重点关注页脚、联系页面、隐私政策、服务条款页面中的邮箱
- 如果发现个人邮箱（如CEO、创始人的邮箱），请特别标注

请以JSON格式回复：
{
  "emails": [
    {
      "email": "邮箱地址",
      "ownerName": "邮箱所有者姓名（如果能识别）",
      "type": "邮箱类型（contact/support/sales/info/personal/other）",
      "source": "邮箱来源描述（如：页脚联系信息、关于页面等）"
    }
  ]
}`
}

// 配置存储（本地持久化）
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
  isAnalyzing: false,
  currentProgress: 0,
  totalItems: 0,
  backgroundTasks: [],
  currentPage: 1,
  itemsPerPage: 100,
  totalCount: 0,

  setAnalyzing: (status) => set({ isAnalyzing: status }),
  setProgress: (current, total) => set({ 
    currentProgress: current, 
    totalItems: total 
  }),

  setPage: (page) => {
    set({ currentPage: page })
    get().loadAnalysisData(page, get().itemsPerPage)
  },

  setItemsPerPage: (count) => {
    set({ itemsPerPage: count, currentPage: 1 })
    get().loadAnalysisData(1, count)
  },

  loadAnalysisData: async (page = 1, limit = 100) => {
    try {
      const response = await fetch(`/api/analysis-data?page=${page}&limit=${limit}`)
      if (response.ok) {
        const data = await response.json()
        set({ 
          analysisData: data.results || [],
          totalCount: data.total || 0,
          currentPage: page
        })
      }
    } catch (error) {
      console.error('Failed to load analysis data:', error)
    }
  },

  getAllPendingUrls: async () => {
    try {
      const response = await fetch('/api/analysis-data/pending-urls')
      if (response.ok) {
        const data = await response.json()
        return data.urls || []
      }
      return []
    } catch (error) {
      console.error('Failed to get all pending URLs:', error)
      return []
    }
  },

  addUrls: async (urls) => {
    try {
      const response = await fetch('/api/analysis-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls })
      })
      
      if (response.ok) {
        // 重新加载当前页数据
        await get().loadAnalysisData(get().currentPage, get().itemsPerPage)
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to add URLs:', error)
      return false
    }
  },

  updateResult: async (id, result) => {
    try {
      const response = await fetch(`/api/analysis-data/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      })
      
      if (response.ok) {
        // 更新本地状态
        set((state) => ({
          analysisData: state.analysisData.map(item =>
            item.id === id ? { ...item, ...result, updatedAt: new Date() } : item
          )
        }))
      }
    } catch (error) {
      console.error('Failed to update result:', error)
    }
  },

  deleteResults: async (ids) => {
    try {
      const response = await fetch('/api/analysis-data', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      })
      
      if (response.ok) {
        await get().loadAnalysisData(get().currentPage, get().itemsPerPage)
      }
    } catch (error) {
      console.error('Failed to delete results:', error)
    }
  },

  clearResults: async () => {
    try {
      const response = await fetch('/api/analysis-data', {
        method: 'DELETE'
      })
      
      if (response.ok) {
        set({ analysisData: [], totalCount: 0 })
      }
    } catch (error) {
      console.error('Failed to clear results:', error)
    }
  },

  addBackgroundTask: (taskId) => set((state) => ({
    backgroundTasks: [...state.backgroundTasks, taskId]
  })),

  removeBackgroundTask: (taskId) => set((state) => ({
    backgroundTasks: state.backgroundTasks.filter(id => id !== taskId)
  })),

  syncBackgroundTaskResults: async (taskId) => {
    try {
      const response = await fetch(`/api/background-task/${taskId}/results`)
      if (response.ok) {
        await get().loadAnalysisData(get().currentPage, get().itemsPerPage)
      }
    } catch (error) {
      console.error('Failed to sync background task results:', error)
    }
  },
}))

// 兼容性导出
export const useStore = () => {
  const configStore = useConfigStore()
  const analysisStore = useAnalysisStore()
  
  return {
    // 配置相关
    config: configStore.config,
    updateConfig: configStore.updateConfig,
    
    // 数据相关
    analysisData: analysisStore.analysisData,
    isAnalyzing: analysisStore.isAnalyzing,
    currentProgress: analysisStore.currentProgress,
    totalItems: analysisStore.totalItems,
    backgroundTasks: analysisStore.backgroundTasks,
    currentPage: analysisStore.currentPage,
    itemsPerPage: analysisStore.itemsPerPage,
    totalCount: analysisStore.totalCount,
    
    // 方法
    loadAnalysisData: analysisStore.loadAnalysisData,
    getAllPendingUrls: analysisStore.getAllPendingUrls,
    addUrls: analysisStore.addUrls,
    updateResult: analysisStore.updateResult,
    deleteResults: analysisStore.deleteResults,
    clearResults: analysisStore.clearResults,
    setAnalyzing: analysisStore.setAnalyzing,
    setProgress: analysisStore.setProgress,
    setPage: analysisStore.setPage,
    setItemsPerPage: analysisStore.setItemsPerPage,
    addBackgroundTask: analysisStore.addBackgroundTask,
    removeBackgroundTask: analysisStore.removeBackgroundTask,
    syncBackgroundTaskResults: analysisStore.syncBackgroundTaskResults,
  }
} 