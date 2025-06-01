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

async function readData(): Promise<AnalysisResult[]> {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function writeData(data: AnalysisResult[]) {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2))
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const updateData = await request.json()
    
    const allData = await readData()
    const itemIndex = allData.findIndex(item => item.id === id)
    
    if (itemIndex === -1) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    
    // 优化存储，限制内容长度
    const optimizedUpdate = { ...updateData }
    if (updateData.crawledContent) {
      optimizedUpdate.crawledContent = {
        title: updateData.crawledContent.title,
        description: updateData.crawledContent.description,
        content: updateData.crawledContent.content?.substring(0, 2000), // 限制内容长度
        pages: undefined // 不存储pages数组，太占空间
      }
    }
    
    allData[itemIndex] = {
      ...allData[itemIndex],
      ...optimizedUpdate,
      updatedAt: new Date()
    }
    
    await writeData(allData)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating analysis result:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
} 