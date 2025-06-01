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
      const parsedData = JSON.parse(fileContent)
      
      // 如果数据是对象格式 {results: []}，则提取results
      if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData) && parsedData.results) {
        return parsedData.results
      } else if (Array.isArray(parsedData)) {
        return parsedData
      } else {
        return []
      }
    } catch {
      return []
    }
  }
}

const dataStore = new DataStore()

export async function GET() {
  try {
    const data = await dataStore.read()

    // 筛选所有待处理的URL
    const pendingUrls = data
      .filter((item: any) => 
        item.status === 'waiting' || 
        item.status === 'failed' || 
        item.status === 'crawl-failed' || 
        item.status === 'analysis-failed' || 
        item.status === 'info-crawl-failed'
      )
      .map((item: any) => item.url)

    return NextResponse.json({
      success: true,
      urls: pendingUrls,
      count: pendingUrls.length
    })

  } catch (error) {
    console.error('Error getting pending URLs:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '获取待处理URL失败',
        urls: [],
        count: 0
      },
      { status: 500 }
    )
  }
} 