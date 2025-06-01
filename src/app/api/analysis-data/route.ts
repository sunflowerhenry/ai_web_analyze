import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

// 检查是否为生产环境
const isProduction = process.env.NODE_ENV === 'production'

// 生产环境使用内存存储，开发环境使用文件存储
let memoryStore: any[] = []

const DATA_FILE = path.join(process.cwd(), 'data', 'analysis-results.json')

// 数据访问层
class DataStore {
  async read(): Promise<any[]> {
    if (isProduction) {
      return memoryStore
    }
    
    try {
      // 确保数据目录存在
      const dataDir = path.dirname(DATA_FILE)
      try {
        await fs.access(dataDir)
      } catch {
        await fs.mkdir(dataDir, { recursive: true })
      }

      const fileContent = await fs.readFile(DATA_FILE, 'utf-8')
      return JSON.parse(fileContent)
    } catch {
      return []
    }
  }

  async write(data: any[]): Promise<void> {
    if (isProduction) {
      memoryStore = [...data]
      return
    }

    try {
      // 确保数据目录存在
      const dataDir = path.dirname(DATA_FILE)
      try {
        await fs.access(dataDir)
      } catch {
        await fs.mkdir(dataDir, { recursive: true })
      }

      await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to write data:', error)
      throw error
    }
  }
}

const dataStore = new DataStore()

interface AnalysisResult {
  id: string
  url: string
  result: 'Y' | 'N' | 'PENDING' | 'ERROR'
  reason: string
  companyInfo?: any
  emails?: any[]
  status: string
  crawledContent?: any
  error?: string
  errorDetails?: any
  createdAt: Date
  updatedAt: Date
  hasInfoCrawled: boolean
  infoCrawlProgress?: number
  backgroundTask?: any
}

// GET - 获取分析数据（分页）
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const page = Number.parseInt(url.searchParams.get('page') || '1')
    const limit = Number.parseInt(url.searchParams.get('limit') || '100')
    
    const data = await dataStore.read()
    
    // 分页处理
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedData = data.slice(startIndex, endIndex)
    
    return NextResponse.json({
      success: true,
      results: paginatedData,
      total: data.length,
      page,
      limit,
      hasNext: endIndex < data.length,
      hasPrev: page > 1
    })
  } catch (error) {
    console.error('Error reading analysis data:', error)
    return NextResponse.json(
      { success: false, error: '读取数据失败' },
      { status: 500 }
    )
  }
}

// POST - 添加新的URL
export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json()
    
    if (!Array.isArray(urls)) {
      return NextResponse.json({ error: 'URLs must be an array' }, { status: 400 })
    }
    
    const allData = await dataStore.read()
    const existingUrls = new Set(allData.map(item => item.url))
    
    const newResults: AnalysisResult[] = urls
      .filter(url => url.trim() && !existingUrls.has(url.trim()))
      .map(url => ({
        id: crypto.randomUUID(),
        url: url.trim(),
        result: 'PENDING' as const,
        reason: '',
        status: 'waiting',
        hasInfoCrawled: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
    
    const updatedData = [...allData, ...newResults]
    
    // 限制总数据量到10000条
    const limitedData = updatedData.length > 10000 
      ? updatedData.slice(-10000) 
      : updatedData
    
    await dataStore.write(limitedData)
    
    console.log(`[API] 添加了 ${newResults.length} 个新URL，总数: ${limitedData.length}`)
    
    return NextResponse.json({ 
      added: newResults.length,
      total: limitedData.length 
    })
  } catch (error) {
    console.error('Error adding URLs:', error)
    return NextResponse.json({ error: 'Failed to add URLs' }, { status: 500 })
  }
}

// DELETE - 删除数据
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { ids } = body
    
    const allData = await dataStore.read()
    
    if (ids && Array.isArray(ids)) {
      // 删除指定ID的数据
      const filteredData = allData.filter(item => !ids.includes(item.id))
      await dataStore.write(filteredData)
      return NextResponse.json({ 
        deleted: allData.length - filteredData.length,
        remaining: filteredData.length 
      })
    } else {
      // 清空所有数据
      await dataStore.write([])
      return NextResponse.json({ deleted: allData.length, remaining: 0 })
    }
  } catch (error) {
    console.error('Error deleting data:', error)
    return NextResponse.json({ error: 'Failed to delete data' }, { status: 500 })
  }
} 