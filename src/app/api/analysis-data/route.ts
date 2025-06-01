import { type NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

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

const DATA_DIR = join(process.cwd(), 'data')
const DATA_FILE = join(DATA_DIR, 'analysis-results.json')

// 确保数据目录存在
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}

// 读取数据
async function readData(): Promise<AnalysisResult[]> {
  await ensureDataDir()
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8')
    const parsed = JSON.parse(data)
    
    // 清理过期数据（7天前的数据）
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const filtered = parsed.filter((item: AnalysisResult) => 
      new Date(item.createdAt) > oneWeekAgo
    )
    
    // 如果有数据被清理，重新写入文件
    if (filtered.length !== parsed.length) {
      await writeData(filtered)
      console.log(`[API] 清理了 ${parsed.length - filtered.length} 条过期数据`)
    }
    
    return filtered
  } catch {
    return []
  }
}

// 写入数据
async function writeData(data: AnalysisResult[]) {
  await ensureDataDir()
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2))
}

// GET - 获取分析数据（分页）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get('page') || '1')
    const limit = Number.parseInt(searchParams.get('limit') || '100')
    
    const allData = await readData()
    
    // 按创建时间倒序排序
    allData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedData = allData.slice(startIndex, endIndex)
    
    return NextResponse.json({
      results: paginatedData,
      total: allData.length,
      page,
      limit,
      totalPages: Math.ceil(allData.length / limit)
    })
  } catch (error) {
    console.error('Error getting analysis data:', error)
    return NextResponse.json({ error: 'Failed to get data' }, { status: 500 })
  }
}

// POST - 添加新的URL
export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json()
    
    if (!Array.isArray(urls)) {
      return NextResponse.json({ error: 'URLs must be an array' }, { status: 400 })
    }
    
    const allData = await readData()
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
    
    await writeData(limitedData)
    
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
    
    const allData = await readData()
    
    if (ids && Array.isArray(ids)) {
      // 删除指定ID的数据
      const filteredData = allData.filter(item => !ids.includes(item.id))
      await writeData(filteredData)
      return NextResponse.json({ 
        deleted: allData.length - filteredData.length,
        remaining: filteredData.length 
      })
    } else {
      // 清空所有数据
      await writeData([])
      return NextResponse.json({ deleted: allData.length, remaining: 0 })
    }
  } catch (error) {
    console.error('Error deleting data:', error)
    return NextResponse.json({ error: 'Failed to delete data' }, { status: 500 })
  }
} 