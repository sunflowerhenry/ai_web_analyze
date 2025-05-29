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
  createdAt: Date
  updatedAt: Date
  hasInfoCrawled: boolean  // 是否已爬取详细信息
  infoCrawlProgress?: number  // 信息爬取进度
}

interface AnalysisState {
  // 配置相关
  config: AIConfig
  updateConfig: (config: Partial<AIConfig>) => void
  
  // 分析数据
  analysisData: AnalysisResult[]
  addUrls: (urls: string[]) => void
  updateResult: (id: string, result: Partial<AnalysisResult>) => void
  deleteResults: (ids: string[]) => void
  clearResults: () => void
  
  // 分析状态
  isAnalyzing: boolean
  currentProgress: number
  totalItems: number
  setAnalyzing: (status: boolean) => void
  setProgress: (current: number, total: number) => void
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

export const useAnalysisStore = create<AnalysisState>()(
  persist(
    (set, get) => ({
      // 配置相关
      config: defaultConfig,
      updateConfig: (newConfig) => {
        console.log('Store updateConfig called with:', newConfig)
        console.log('Current config before update:', get().config)
        
        set((state) => {
          const updatedConfig = { ...state.config, ...newConfig }
          console.log('Updated config (before set):', updatedConfig)
          
          return { config: updatedConfig }
        })
        
        // 验证更新后的状态
        setTimeout(() => {
          const currentState = get()
          console.log('Store state after update:', currentState.config)
        }, 50)
      },
      
      // 分析数据
      analysisData: [],
      addUrls: (urls) =>
        set((state) => {
          const existingUrls = new Set(state.analysisData.map(item => item.url))
          const newResults: AnalysisResult[] = urls
            .filter(url => url.trim() && !existingUrls.has(url.trim()))
            .map(url => ({
              id: crypto.randomUUID(),
              url: url.trim(),
              result: 'PENDING' as const,
              reason: '',
              status: 'waiting' as const,
              hasInfoCrawled: false,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          
          return {
            analysisData: [...state.analysisData, ...newResults]
          }
        }),
      
      updateResult: (id, result) =>
        set((state) => ({
          analysisData: state.analysisData.map(item =>
            item.id === id
              ? { ...item, ...result, updatedAt: new Date() }
              : item
          )
        })),
      
      deleteResults: (ids) =>
        set((state) => ({
          analysisData: state.analysisData.filter(item => !ids.includes(item.id))
        })),
      
      clearResults: () => set({ analysisData: [] }),
      
      // 分析状态
      isAnalyzing: false,
      currentProgress: 0,
      totalItems: 0,
      setAnalyzing: (status) => set({ isAnalyzing: status }),
      setProgress: (current, total) => set({ currentProgress: current, totalItems: total })
    }),
    {
      name: 'analysis-store',
      partialize: (state) => ({
        config: state.config,
        analysisData: state.analysisData
      }),
      onRehydrateStorage: () => (state) => {
        console.log('Rehydrating store:', state)
        if (state?.config) {
          console.log('Config loaded from storage:', state.config)
        }
      },
      version: 1,
      migrate: (persistedState: any, version: number) => {
        console.log('Migrating store from version:', version)
        return persistedState
      }
    }
  )
) 