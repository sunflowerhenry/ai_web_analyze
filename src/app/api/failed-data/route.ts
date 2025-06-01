import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

// 检查是否为生产环境
const isProduction = process.env.NODE_ENV === 'production'

// 生产环境使用内存存储，开发环境使用文件存储
let memoryFailedStore: any[] = []

const FAILED_DATA_FILE = path.join(process.cwd(), 'data', 'failed-analysis.json')

// 失败数据存储层
class FailedDataStore {
  async read(): Promise<any[]> {
    if (isProduction) {
      return memoryFailedStore
    }
    
    try {
      // 确保数据目录存在
      const dataDir = path.dirname(FAILED_DATA_FILE)
      try {
        await fs.access(dataDir)
      } catch {
        await fs.mkdir(dataDir, { recursive: true })
      }

      const fileContent = await fs.readFile(FAILED_DATA_FILE, 'utf-8')
      return JSON.parse(fileContent)
    } catch {
      // 文件不存在时返回空数组
      return []
    }
  }

  async write(data: any[]): Promise<void> {
    if (isProduction) {
      memoryFailedStore = [...data]
      return
    }

    try {
      // 确保数据目录存在
      const dataDir = path.dirname(FAILED_DATA_FILE)
      try {
        await fs.access(dataDir)
      } catch {
        await fs.mkdir(dataDir, { recursive: true })
      }

      await fs.writeFile(FAILED_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to write failed data:', error)
      throw error
    }
  }
}

const failedDataStore = new FailedDataStore()

export async function GET() {
  try {
    const data = await failedDataStore.read()
    
    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      filePath: isProduction ? '内存存储' : FAILED_DATA_FILE
    })
  } catch (error) {
    console.error('Error reading failed data:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: '读取失败数据时出错',
        data: [],
        count: 0
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const newFailedItem = await request.json()
    
    const existingData = await failedDataStore.read()
    const updatedData = [...existingData, {
      ...newFailedItem,
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID()
    }]
    
    // 限制失败数据条目数量（最多保存1000条）
    const limitedData = updatedData.length > 1000 
      ? updatedData.slice(-1000) 
      : updatedData
    
    await failedDataStore.write(limitedData)
    
    return NextResponse.json({
      success: true,
      added: 1,
      total: limitedData.length
    })
  } catch (error) {
    console.error('Error adding failed data:', error)
    return NextResponse.json(
      { success: false, error: '添加失败数据时出错' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    await failedDataStore.write([])
    
    return NextResponse.json({
      success: true,
      message: '所有失败数据已清空'
    })
  } catch (error) {
    console.error('Error clearing failed data:', error)
    return NextResponse.json(
      { success: false, error: '清空失败数据时出错' },
      { status: 500 }
    )
  }
} 