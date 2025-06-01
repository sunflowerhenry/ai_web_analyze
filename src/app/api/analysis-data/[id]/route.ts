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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const updates = await request.json()
    
    const allData = await dataStore.read()
    const index = allData.findIndex((item: any) => item.id === id)
    
    if (index === -1) {
      return NextResponse.json(
        { success: false, error: '项目不存在' },
        { status: 404 }
      )
    }
    
    // 更新项目
    allData[index] = {
      ...allData[index],
      ...updates,
      updatedAt: new Date().toISOString()
    }
    
    await dataStore.write(allData)
    
    return NextResponse.json({
      success: true,
      result: allData[index]
    })
  } catch (error) {
    console.error('Error updating analysis result:', error)
    return NextResponse.json(
      { success: false, error: '更新失败' },
      { status: 500 }
    )
  }
} 