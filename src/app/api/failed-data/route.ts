import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const FAILED_DATA_FILE = path.join(process.cwd(), 'data', 'failed-analysis.json')

interface FailedAnalysisData {
  id: string
  url: string
  timestamp: string
  stage: string // 'crawling', 'analyzing', 'info-crawling'
  errorType: string
  errorMessage: string
  requestData?: any
  responseData?: any
  stackTrace?: string
  userAgent?: string
  proxyUsed?: string
  configUsed?: any
}

// 确保数据目录存在
async function ensureDataDirectory() {
  const dataDir = path.dirname(FAILED_DATA_FILE)
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
}

// 读取失败数据
async function readFailedData(): Promise<FailedAnalysisData[]> {
  await ensureDataDirectory()
  try {
    const data = await fs.readFile(FAILED_DATA_FILE, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

// 写入失败数据
async function writeFailedData(data: FailedAnalysisData[]) {
  await ensureDataDirectory()
  await fs.writeFile(FAILED_DATA_FILE, JSON.stringify(data, null, 2))
}

// GET - 获取所有失败数据
export async function GET() {
  try {
    const failedData = await readFailedData()
    
    return NextResponse.json({
      success: true,
      data: failedData,
      total: failedData.length,
      filePath: FAILED_DATA_FILE
    })
  } catch (error) {
    console.error('Failed to read failed data:', error)
    return NextResponse.json(
      { success: false, error: '读取失败数据时发生错误' },
      { status: 500 }
    )
  }
}

// POST - 添加失败数据
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, stage, errorType, errorMessage, requestData, responseData, stackTrace, userAgent, proxyUsed, configUsed } = body

    if (!url || !stage || !errorType || !errorMessage) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      )
    }

    const failedData = await readFailedData()
    
    const newFailedEntry: FailedAnalysisData = {
      id: `failed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url,
      timestamp: new Date().toISOString(),
      stage,
      errorType,
      errorMessage,
      requestData,
      responseData,
      stackTrace,
      userAgent,
      proxyUsed,
      configUsed
    }

    failedData.push(newFailedEntry)
    
    // 保持最近的1000条失败记录
    if (failedData.length > 1000) {
      failedData.splice(0, failedData.length - 1000)
    }

    await writeFailedData(failedData)
    
    return NextResponse.json({
      success: true,
      message: '失败数据已保存',
      data: newFailedEntry
    })
  } catch (error) {
    console.error('Failed to save failed data:', error)
    return NextResponse.json(
      { success: false, error: '保存失败数据时发生错误' },
      { status: 500 }
    )
  }
}

// DELETE - 删除失败数据
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const deleteAll = searchParams.get('all') === 'true'

    if (deleteAll) {
      await writeFailedData([])
      return NextResponse.json({
        success: true,
        message: '所有失败数据已清空'
      })
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少ID参数' },
        { status: 400 }
      )
    }

    const failedData = await readFailedData()
    const filteredData = failedData.filter(item => item.id !== id)
    
    if (filteredData.length === failedData.length) {
      return NextResponse.json(
        { success: false, error: '未找到指定的失败数据' },
        { status: 404 }
      )
    }

    await writeFailedData(filteredData)
    
    return NextResponse.json({
      success: true,
      message: '失败数据已删除'
    })
  } catch (error) {
    console.error('Failed to delete failed data:', error)
    return NextResponse.json(
      { success: false, error: '删除失败数据时发生错误' },
      { status: 500 }
    )
  }
} 