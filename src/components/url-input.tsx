'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Upload, Play, PlayCircle, AlertTriangle } from 'lucide-react'
import { useStore } from '@/store/analysis-store'
import { toast } from 'sonner'

export function UrlInput() {
  const [inputText, setInputText] = useState('')
  const [backgroundTaskId, setBackgroundTaskId] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const { addUrls, config, addBackgroundTask, syncBackgroundTaskResults } = useStore()

  // 检查配置状态
  const isConfigComplete = !!(config?.apiKey && config?.apiUrl && config?.modelName)

  const handleAddUrls = async () => {
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
      setIsAdding(true)
      try {
        // 使用异步添加URL
        const success = await addUrls(validUrls)
        
        if (success) {
          setInputText('')
          toast.success(`成功添加 ${validUrls.length} 个网站链接`, {
            description: isConfigComplete ? '请点击分析表格中的开始按钮开始分析' : '请先完成AI配置',
            duration: 5000
          })
        } else {
          toast.error('添加URL失败，请重试')
        }
      } catch (error) {
        console.error('添加URL失败:', error)
        toast.error('添加URL失败，请重试')
      } finally {
        setIsAdding(false)
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
          await updateRealtimeStatus(statusData)
          
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
  const updateRealtimeStatus = async (statusData: any) => {
    const store = useStore()
    
    try {
      // 确保所有新URL都已添加到分析数据中
      const allUrls = [
        ...statusData.recentResults?.map((r: any) => r.url) || [],
        ...statusData.recentErrors?.map((e: any) => e.url) || [],
        ...statusData.currentlyProcessing || []
      ].filter(url => url)
      
      if (allUrls.length > 0) {
        // 添加新URL（API会自动去重）
        await store.addUrls(allUrls)
      }
      
      // 更新正在处理的URL状态
      if (statusData.currentlyProcessing && statusData.currentlyProcessing.length > 0) {
        for (const url of statusData.currentlyProcessing) {
          const existingItem = store.analysisData.find(item => item.url === url)
          if (existingItem && existingItem.status === 'waiting') {
            await store.updateResult(existingItem.id, {
              status: 'analyzing'
            })
          }
        }
      }
      
      // 更新最近完成的结果
      if (statusData.recentResults && statusData.recentResults.length > 0) {
        for (const result of statusData.recentResults) {
          const existingItem = store.analysisData.find(item => item.url === result.url)
          if (existingItem) {
            await store.updateResult(existingItem.id, {
              result: result.analyzeData?.result || 'PENDING',
              reason: result.analyzeData?.reason || '',
              status: 'completed',
              crawledContent: result.crawlData
            })
          }
        }
      }
      
      // 更新最近的错误
      if (statusData.recentErrors && statusData.recentErrors.length > 0) {
        for (const error of statusData.recentErrors) {
          const existingItem = store.analysisData.find(item => item.url === error.url)
          if (existingItem) {
            await store.updateResult(existingItem.id, {
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
        }
      }
    } catch (error) {
      console.error('更新实时状态失败:', error)
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
    <Card className="shadow-sm border-slate-200 bg-white/90">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-green-600" />
          批量添加网站链接
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          输入要分析的网站链接，每行一个，支持文件批量导入
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Textarea
            placeholder="请输入网站链接，每行一个，例如：&#10;https://example.com&#10;https://company.com&#10;www.website.com"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="min-h-32 resize-none shadow-sm"
          />
          
          <div className="flex gap-2">
            <Button 
              onClick={handleAddUrls} 
              className="flex-1 bg-green-600 hover:bg-green-700 shadow-sm" 
              disabled={isAdding}
            >
              <Plus className="h-4 w-4 mr-2" />
              {isAdding ? '添加中...' : '添加到分析列表'}
            </Button>
            
            <div className="relative">
              <Button variant="outline" className="shadow-sm">
                <Upload className="h-4 w-4 mr-2" />
                文件导入
              </Button>
              <input
                type="file"
                accept=".txt,.csv"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
          
          {/* 配置状态提示 */}
          {!isConfigComplete && (
            <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-orange-700">
                请先完成 <a href="/config" className="underline font-medium">AI配置</a> 后再开始分析
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
} 