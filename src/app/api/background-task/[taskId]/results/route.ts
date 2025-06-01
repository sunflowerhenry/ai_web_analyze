import { type NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params
    
    // 调用现有的后台任务API获取结果
    const response = await fetch(`${request.nextUrl.origin}/api/background-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'results',
        taskId
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      return NextResponse.json(data)
    } else {
      return NextResponse.json({ error: 'Failed to get task results' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error getting background task results:', error)
    return NextResponse.json({ error: 'Failed to get task results' }, { status: 500 })
  }
} 