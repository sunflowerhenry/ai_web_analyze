'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Upload, Play, PlayCircle, AlertTriangle } from 'lucide-react'
import { useAnalysisStore } from '@/store/analysis-store'
import { toast } from 'sonner'

export function UrlInput() {
  const [inputText, setInputText] = useState('')
  const [backgroundTaskId, setBackgroundTaskId] = useState<string | null>(null)
  const { addUrls, config, addBackgroundTask, syncBackgroundTaskResults } = useAnalysisStore()

  // 检查配置状态
  const isConfigComplete = !!(config?.apiKey && config?.apiUrl && config?.modelName)

  const handleAddUrls = () => {
    if (!inputText.trim()) {
      toast.error('请输入网站链接')
      return
    }

    // 解析输入的URL
    const urls = inputText
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0)
      .map(url => {
        // 自动添加协议
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return `https://${url}`
        }
        return url
      })

    if (urls.length === 0) {
      toast.error('没有找到有效的链接')
      return
    }

    // 验证URL格式
    const validUrls: string[] = []
    const invalidUrls: string[] = []

    urls.forEach(url => {
      try {
        new URL(url)
        validUrls.push(url)
      } catch {
        invalidUrls.push(url)
      }
    })

    if (invalidUrls.length > 0) {
      toast.error(`发现 ${invalidUrls.length} 个无效链接，已跳过`)
    }

    if (validUrls.length > 0) {
      // 直接添加到分析表格
      addUrls(validUrls)
      setInputText('')
      toast.success(`成功添加 ${validUrls.length} 个网站链接`)

      // 如果配置完整，自动开始后台分析
      if (isConfigComplete) {
        handleBackgroundTask(validUrls)
      }
    }
  }

  const handleBackgroundTask = async (urls: string[]) => {
    try {
      const response = await fetch('/api/background-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          urls,
          config,
          type: 'analyze'
        })
      })

      const result = await response.json()

      if (response.ok) {
        setBackgroundTaskId(result.taskId)
        
        if (result.status === 'added_to_existing') {
          toast.success(`已向现有任务添加 ${urls.length} 个网站`, {
            description: `当前任务共有 ${result.totalUrls} 个网站待分析`,
            duration: 3000
          })
        } else {
          addBackgroundTask(result.taskId) // 只在创建新任务时保存到存储
          toast.success(`后台任务已创建！任务ID: ${result.taskId.substring(0, 8)}...`, {
            description: '即使关闭页面，任务也会继续运行',
            duration: 5000
          })
        }

        // 启动实时状态监控
        startRealtimeMonitoring(result.taskId, urls)

      } else {
        toast.error(`创建后台任务失败: ${result.error}`)
      }
    } catch (error) {
      toast.error(`创建后台任务失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 实时监控任务状态并更新前端显示
  const startRealtimeMonitoring = (taskId: string, urls: string[]) => {
    const monitorInterval = setInterval(async () => {
      try {
        const statusResponse = await fetch('/api/background-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'realtime-status',
            taskId
          })
        })
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          
          // 实时更新前端状态
          updateRealtimeStatus(statusData)
          
          if (statusData.status === 'completed') {
            clearInterval(monitorInterval)
            toast.success('后台任务已完成！', {
              description: `处理了 ${statusData.summary.completed} 个网站`,
            })
          } else if (statusData.status === 'failed') {
            clearInterval(monitorInterval)
            toast.error('后台任务失败')
          }
        }
      } catch (error) {
        console.error('监控任务状态失败:', error)
      }
    }, 2000) // 每2秒检查一次，提高实时性

    // 10分钟后停止检查
    setTimeout(() => {
      clearInterval(monitorInterval)
    }, 600000)
  }

  // 实时更新状态和结果
  const updateRealtimeStatus = (statusData: any) => {
    const { updateResult, analysisData } = useAnalysisStore.getState()
    
    // 更新正在处理的URL状态
    if (statusData.currentlyProcessing && statusData.currentlyProcessing.length > 0) {
      statusData.currentlyProcessing.forEach((url: string) => {
        const existingItem = analysisData.find(item => item.url === url)
        if (existingItem && existingItem.status === 'waiting') {
          updateResult(existingItem.id, {
            status: 'analyzing'
          })
        }
      })
    }
    
    // 更新最近完成的结果
    if (statusData.recentResults && statusData.recentResults.length > 0) {
      statusData.recentResults.forEach((result: any) => {
        const existingItem = analysisData.find(item => item.url === result.url)
        if (existingItem) {
          updateResult(existingItem.id, {
            result: result.analyzeData?.result || 'PENDING',
            reason: result.analyzeData?.reason || '',
            status: 'completed',
            crawledContent: result.crawlData
          })
        }
      })
    }
    
    // 更新最近的错误
    if (statusData.recentErrors && statusData.recentErrors.length > 0) {
      statusData.recentErrors.forEach((error: any) => {
        const existingItem = analysisData.find(item => item.url === error.url)
        if (existingItem) {
          updateResult(existingItem.id, {
            result: 'ERROR',
            reason: error.message,
            status: 'failed',
            error: error.message,
            errorDetails: {
              type: error.type || 'unknown_error',
              stage: error.stage || 'crawling',
              message: error.message,
              retryable: true
            }
          })
        }
      })
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setInputText(content)
    }
    reader.readAsText(file)
  }

  const urlCount = inputText.split('\n').filter(line => line.trim()).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          添加网站链接 (后台分析模式)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Textarea
            placeholder="请输入网站链接，每行一个：&#10;example.com&#10;https://another-site.com&#10;www.third-site.com"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={6}
            className="resize-none"
          />
          <p className="text-sm text-muted-foreground mt-2">
            支持多种格式：example.com、https://example.com、www.example.com
            <br />
            <span className="text-blue-600 font-medium">✨ 任务将在后台运行，即使关闭页面也会继续分析</span>
          </p>
        </div>

        {!isConfigComplete && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">
              请先完成AI配置才能启用分析功能
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleAddUrls} className="flex-1">
            {isConfigComplete ? (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                添加并开始分析
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                添加到列表
              </>
            )}
          </Button>
          
          <div className="relative">
            <input
              type="file"
              accept=".txt,.csv"
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              上传文件
            </Button>
          </div>
        </div>

        {inputText && (
          <div className="text-sm text-muted-foreground">
            当前输入了 {urlCount} 个链接
            {isConfigComplete && (
              <span className="ml-2 text-blue-600 font-medium">
                · 将在后台自动分析，关闭页面后仍会继续
              </span>
            )}
          </div>
        )}

        {backgroundTaskId && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-sm text-blue-800">
              <strong>后台任务已创建</strong>
            </div>
            <div className="text-xs text-blue-600 mt-1">
              任务ID: {backgroundTaskId}
            </div>
            <div className="text-xs text-blue-600">
              即使关闭页面，任务也会继续运行
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 