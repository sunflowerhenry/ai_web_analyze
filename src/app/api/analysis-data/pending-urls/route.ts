import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const DATA_FILE = path.join(process.cwd(), 'data', 'analysis-results.json')

export async function GET() {
  try {
    // 确保数据目录存在
    const dataDir = path.dirname(DATA_FILE)
    try {
      await fs.access(dataDir)
    } catch {
      await fs.mkdir(dataDir, { recursive: true })
    }

    // 读取数据文件
    let data: any[] = []
    try {
      const fileContent = await fs.readFile(DATA_FILE, 'utf-8')
      const parsedData = JSON.parse(fileContent)
      
      // 如果数据是对象格式 {results: []}，则提取results
      if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData) && parsedData.results) {
        data = parsedData.results
      } else if (Array.isArray(parsedData)) {
        data = parsedData
      } else {
        data = []
      }
    } catch {
      // 文件不存在或无法解析，使用默认数据
      data = []
    }

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