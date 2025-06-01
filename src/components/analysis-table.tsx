'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Play, 
  Trash2, 
  Download, 
  Copy, 
  RefreshCw, 
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  StopCircle,
  Mail,
  Building,
  Filter,
  ArrowUpDown,
  Eye,
  EyeOff,
  PlayCircle,
  ChevronLeft,
  ChevronRight as ChevronRightIcon
} from 'lucide-react'
import { useStore, type AnalysisResult } from '@/store/analysis-store'
import { toast } from 'sonner'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { Progress } from '@/components/ui/progress'

export function AnalysisTable() {
  const { 
    analysisData, 
    deleteResults, 
    clearResults, 
    updateResult, 
    isAnalyzing, 
    setAnalyzing, 
    setProgress,
    config,
    currentPage,
    itemsPerPage,
    totalCount,
    setPage,
    loadAnalysisData,
    getAllPendingUrls
  } = useStore()
  
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set())
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set())
  
  // 新增状态 - 使用 useRef 确保在异步操作中能正确访问最新状态
  const [isStopRequested, setIsStopRequested] = useState(false)
  const stopRequestedRef = useRef(false)
  const [currentAnalysisControllers, setCurrentAnalysisControllers] = useState<AbortController[]>([])
  
  // 新增：实时进度监控状态
  const [analysisProgress, setAnalysisProgress] = useState({
    current: 0,
    total: 0,
    isActive: false,
    currentUrl: '',
    stage: '' // 'crawling', 'analyzing', 'info-crawling'
  })

  // 新增：后台任务监控状态
  const [backgroundTask, setBackgroundTask] = useState<{
    taskId: string | null,
    isMonitoring: boolean,
    status: 'pending' | 'running' | 'completed' | 'failed' | null,
    progress: { current: number; total: number },
    summary?: {
      total: number,
      completed: number,
      failed: number,
      remaining: number
    }
  }>({
    taskId: null,
    isMonitoring: false,
    status: null,
    progress: { current: 0, total: 0 },
    summary: undefined
  })

  const backgroundMonitorRef = useRef<NodeJS.Timeout | null>(null)
  
  // 筛选和排序状态（本地筛选）
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterResult, setFilterResult] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  
  const [showTableSettings, setShowTableSettings] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // 同步停止状态到 ref
  useEffect(() => {
    stopRequestedRef.current = isStopRequested
  }, [isStopRequested])

  // 后台任务监控
  const startBackgroundTaskMonitoring = (taskId: string) => {
    if (backgroundMonitorRef.current) {
      clearInterval(backgroundMonitorRef.current)
    }

    setBackgroundTask(prev => ({
      ...prev,
      taskId,
      isMonitoring: true
    }))

    backgroundMonitorRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/background-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'realtime-status',
            taskId
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          
          setBackgroundTask(prev => ({
            ...prev,
            status: data.status,
            progress: data.progress,
            summary: data.summary
          }))
          
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(backgroundMonitorRef.current!)
            backgroundMonitorRef.current = null
            
            setBackgroundTask(prev => ({
              ...prev,
              isMonitoring: false
            }))
            
            // 刷新数据
            await loadAnalysisData(currentPage, itemsPerPage)
            
            if (data.status === 'completed') {
              toast.success(`后台任务已完成！处理了 ${data.summary.completed} 个网站`)
            } else {
              toast.error('后台任务失败')
            }
          }
        }
      } catch (error) {
        console.error('监控后台任务失败:', error)
      }
    }, 3000) // 每3秒检查一次
  }

  // 停止后台任务监控
  const stopBackgroundTaskMonitoring = () => {
    if (backgroundMonitorRef.current) {
      clearInterval(backgroundMonitorRef.current)
      backgroundMonitorRef.current = null
    }
    
    setBackgroundTask({
      taskId: null,
      isMonitoring: false,
      status: null,
      progress: { current: 0, total: 0 },
      summary: undefined
    })
  }

  // 清理监控
  useEffect(() => {
    return () => {
      if (backgroundMonitorRef.current) {
        clearInterval(backgroundMonitorRef.current)
      }
    }
  }, [])

  // 检查并恢复正在运行的后台任务
  useEffect(() => {
    const checkRunningBackgroundTasks = async () => {
      try {
        const response = await fetch('/api/background-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'list' })
        })
        
        if (response.ok) {
          const data = await response.json()
          const runningTask = data.tasks.find((task: any) => 
            task.status === 'running' || task.status === 'pending'
          )
          
          if (runningTask) {
            toast.info('发现正在运行的后台任务，已自动恢复监控')
            startBackgroundTaskMonitoring(runningTask.id)
          }
        }
      } catch (error) {
        console.error('检查后台任务失败:', error)
      }
    }
    
    // 延迟1秒后检查，确保页面加载完成
    const timer = setTimeout(checkRunningBackgroundTasks, 1000)
    
    return () => clearTimeout(timer)
  }, [])

  // 筛选后的数据（本地筛选）
  const filteredData = useMemo(() => {
    let filtered = analysisData
    
    // 搜索筛选
    if (searchQuery.trim()) {
      filtered = filtered.filter(item => 
        item.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.reason && item.reason.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.companyInfo?.primaryName && item.companyInfo.primaryName.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    }
    
    // 状态筛选
    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => item.status === filterStatus)
    }
    
    // 结果筛选
    if (filterResult !== 'all') {
      filtered = filtered.filter(item => item.result === filterResult)
    }
    
    return filtered
  }, [analysisData, filterStatus, filterResult, searchQuery])

  // 分页计算
  const totalPages = Math.ceil(totalCount / itemsPerPage)
  const hasLocalFilter = filterStatus !== 'all' || filterResult !== 'all' || searchQuery.trim() !== ''

  // 刷新数据
  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await loadAnalysisData(currentPage, itemsPerPage)
      toast.success('数据已刷新')
    } catch (error) {
      toast.error('刷新数据失败')
    } finally {
      setIsRefreshing(false)
    }
  }

  // 检查是否可以开始分析
  const canStartAnalysis = analysisData.some(item => 
    item.status === 'waiting' || 
    item.status === 'failed' || 
    item.status === 'crawl-failed' || 
    item.status === 'analysis-failed' || 
    item.status === 'info-crawl-failed'
  )

  // 检查是否可以一键爬取
  const canCrawlAll = analysisData.some(item => 
    item.result === 'Y' && !item.hasInfoCrawled
  )

  // 状态图标映射
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting': return <Clock className="h-4 w-4 text-gray-500" />
      case 'crawling': return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      case 'analyzing': return <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />
      case 'info-crawling': return <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />
      case 'crawl-failed': return <XCircle className="h-4 w-4 text-red-500" />
      case 'analysis-failed': return <XCircle className="h-4 w-4 text-orange-500" />
      case 'info-crawl-failed': return <XCircle className="h-4 w-4 text-purple-500" />
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  // 结果徽章
  const getResultBadge = (result: string) => {
    switch (result) {
      case 'Y': return <Badge variant="default" className="bg-green-500">是</Badge>
      case 'N': return <Badge variant="secondary">否</Badge>
      case 'ERROR': return <Badge variant="destructive">错误</Badge>
      default: return <Badge variant="outline">待分析</Badge>
    }
  }

  // 全选/取消全选（当前页）
  const handleSelectAll = (checked: boolean) => {
    const displayData = hasLocalFilter ? filteredData : analysisData
    if (checked) {
      setSelectedIds(displayData.map(item => item.id))
    } else {
      setSelectedIds([])
    }
  }

  // 单项选择
  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id])
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id))
    }
  }

  // 删除选中项
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) {
      toast.error('请先选择要删除的项目')
      return
    }
    
    try {
      await deleteResults(selectedIds)
      setSelectedIds([])
      toast.success(`已删除 ${selectedIds.length} 个项目`)
      // 重新加载当前页数据
      await loadAnalysisData(currentPage, itemsPerPage)
    } catch (error) {
      toast.error('删除失败，请重试')
    }
  }

  // 清空所有数据
  const handleClearAll = async () => {
    if (totalCount === 0) {
      toast.error('没有数据可以清空')
      return
    }
    
    try {
      await clearResults()
      setSelectedIds([])
      toast.success('所有数据已清空')
    } catch (error) {
      toast.error('清空失败，请重试')
    }
  }

  // 复制所有数据
  const handleCopyData = () => {
    if (filteredData.length === 0) {
      toast.error('没有数据可复制')
      return
    }

    const headers = ['网站链接', '判断结果', '判断依据', '公司信息', '邮箱信息', '分析状态']
    const rows = filteredData.map(item => [
      item.url,
      item.result === 'Y' ? '是' : item.result === 'N' ? '否' : item.result,
      item.reason || '',
      formatCompanyInfo(item.companyInfo),
      formatEmails(item.emails),
      getStatusText(item.status)
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join('\t'))
      .join('\n')

    navigator.clipboard.writeText(csvContent).then(() => {
      toast.success('所有数据已复制到剪贴板')
    }).catch(() => {
      toast.error('复制失败')
    })
  }

  // 复制选中的数据
  const handleCopySelected = () => {
    if (selectedIds.length === 0) {
      toast.error('请先选择要复制的项目')
      return
    }

    const selectedData = filteredData.filter(item => selectedIds.includes(item.id))
    
    const headers = ['网站链接', '判断结果', '判断依据', '公司信息', '邮箱信息', '分析状态']
    const rows = selectedData.map(item => [
      item.url,
      item.result === 'Y' ? '是' : item.result === 'N' ? '否' : item.result,
      item.reason || '',
      formatCompanyInfo(item.companyInfo),
      formatEmails(item.emails),
      getStatusText(item.status)
    ])

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join('\t'))
      .join('\n')

    navigator.clipboard.writeText(csvContent).then(() => {
      toast.success(`已复制 ${selectedData.length} 条选中数据到剪贴板`)
    }).catch(() => {
      toast.error('复制失败')
    })
  }

  // 导出数据
  const handleExport = (format: 'excel' | 'csv' | 'json') => {
    if (filteredData.length === 0) {
      toast.error('没有数据可导出')
      return
    }

    try {
      const dataToExport = filteredData.map(item => ({
        网站地址: item.url,
        分析结果: item.result === 'Y' ? '是' : item.result === 'N' ? '否' : item.result,
        判断依据: item.reason || '',
        公司名称: item.companyInfo?.primaryName || '',
        所有公司名称: item.companyInfo?.names?.join(', ') || '',
        创始人信息: item.companyInfo?.founderNames?.join(', ') || '',
        品牌名称: item.companyInfo?.brandNames?.join(', ') || '',
        邮箱信息: formatEmails(item.emails),
        邮箱详情: item.emails && Array.isArray(item.emails) ? 
          item.emails.map(email => 
            `${email.email}${email.ownerName ? ` (${email.ownerName})` : ''}${email.source ? ` - ${email.source}` : ''}`
          ).join('; ') : '',
        分析状态: getStatusText(item.status),
        是否已爬取信息: item.hasInfoCrawled ? '是' : '否',
        创建时间: new Date(item.createdAt).toLocaleString('zh-CN'),
        更新时间: new Date(item.updatedAt).toLocaleString('zh-CN'),
        错误信息: item.error || ''
      }))

      if (format === 'excel') {
        const ws = XLSX.utils.json_to_sheet(dataToExport)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, '分析结果')
        
        // 设置列宽
        const colWidths = [
          { wch: 50 }, // 网站地址
          { wch: 10 }, // 分析结果
          { wch: 30 }, // 判断依据
          { wch: 20 }, // 公司名称
          { wch: 30 }, // 所有公司名称
          { wch: 20 }, // 创始人信息
          { wch: 20 }, // 品牌名称
          { wch: 30 }, // 邮箱信息
          { wch: 50 }, // 邮箱详情
          { wch: 12 }, // 分析状态
          { wch: 12 }, // 是否已爬取信息
          { wch: 20 }, // 创建时间
          { wch: 20 }, // 更新时间
          { wch: 30 }  // 错误信息
        ]
        ws['!cols'] = colWidths
        
        const fileName = `网站分析结果_${new Date().toISOString().slice(0, 10)}.xlsx`
        XLSX.writeFile(wb, fileName)
        toast.success('Excel文件已下载')
        
      } else if (format === 'csv') {
        const headers = Object.keys(dataToExport[0] || {})
        const csvContent = [
          headers.join(','),
          ...dataToExport.map(row => 
            headers.map(header => `"${String(row[header as keyof typeof row] || '').replace(/"/g, '""')}"`).join(',')
          )
        ].join('\n')
        
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `网站分析结果_${new Date().toISOString().slice(0, 10)}.csv`
        link.click()
        toast.success('CSV文件已下载')
        
      } else if (format === 'json') {
        const jsonContent = JSON.stringify(dataToExport, null, 2)
        const blob = new Blob([jsonContent], { type: 'application/json' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `网站分析结果_${new Date().toISOString().slice(0, 10)}.json`
        link.click()
        toast.success('JSON文件已下载')
      }
    } catch (error) {
      toast.error('导出失败')
      console.error('Export error:', error)
    }
  }

  // 开始分析（支持后台任务）
  const handleStartAnalysis = async () => {
    if (!config.apiKey) {
      toast.error('请先配置AI API密钥')
      return
    }

    // 先从当前页数据检查是否有待分析项目
    const currentPagePendingItems = analysisData.filter(item => 
      item.status === 'waiting' || 
      item.status === 'failed' || 
      item.status === 'crawl-failed' || 
      item.status === 'analysis-failed' || 
      item.status === 'info-crawl-failed'
    )

    if (currentPagePendingItems.length === 0) {
      toast.error('当前页没有待分析的项目')
      return
    }

    try {
      // 从服务端获取所有待处理的URL
      const allPendingUrls = await getAllPendingUrls()

      if (allPendingUrls.length === 0) {
        toast.error('没有待分析的项目')
        return
      }

      // 检查是否要使用后台任务（超过50个URL）
      if (allPendingUrls.length > 50) {
        try {
          // 创建后台任务
          const response = await fetch('/api/background-task', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              type: 'analyze',
              urls: allPendingUrls,
              config: config
            })
          })

          if (response.ok) {
            const data = await response.json()
            
            toast.success(`已创建后台任务，将处理 ${allPendingUrls.length} 个网站，即使关闭网页也会继续运行！任务ID: ${data.taskId.substring(0, 8)}`)
            
            // 开始监控后台任务
            startBackgroundTaskMonitoring(data.taskId)
            
            return
          } else {
            throw new Error('创建后台任务失败')
          }
        } catch (error) {
          console.error('创建后台任务失败:', error)
          toast.error('创建后台任务失败，将使用前台分析')
          // 继续使用前台分析（使用当前页数据）
        }
      }

    } catch (error) {
      console.error('获取待处理数据失败:', error)
      toast.error('获取待处理数据失败，将使用当前页数据进行分析')
    }

    // 前台分析逻辑（使用当前页数据）
    const pendingItems = currentPagePendingItems
    const controllers: AbortController[] = []
    setCurrentAnalysisControllers(controllers)
    setAnalyzing(true)
    setIsStopRequested(false)
    stopRequestedRef.current = false
    setProgress(0, pendingItems.length)

    // 初始化进度监控
    setAnalysisProgress({
      current: 0,
      total: pendingItems.length,
      isActive: true,
      currentUrl: '',
      stage: 'preparing'
    })

    try {
      const concurrency = config.concurrencySettings?.enabled ? 
        config.concurrencySettings.maxConcurrent : 1
      
      let completed = 0
      
      for (let i = 0; i < pendingItems.length; i += concurrency) {
        if (stopRequestedRef.current) {
          console.log('Analysis stop requested, breaking loop')
          break
        }

        const batch = pendingItems.slice(i, Math.min(i + concurrency, pendingItems.length))
        
        const batchPromises = batch.map(async (item) => {
          if (stopRequestedRef.current) {
            return
          }

          const controller = new AbortController()
          controllers.push(controller)
          
          try {
            setAnalysisProgress(prev => ({ 
              ...prev, 
              currentUrl: item.url, 
              stage: 'crawling' 
            }))
            
            updateResult(item.id, { status: 'crawling' })
            
            const crawlResponse = await axios.post('/api/crawl', {
              url: item.url,
              config: config
            }, {
              signal: controller.signal,
              timeout: 30000
            })

            if (stopRequestedRef.current) return

            if (crawlResponse.data.success) {
              setAnalysisProgress(prev => ({ 
                ...prev, 
                currentUrl: item.url, 
                stage: 'analyzing' 
              }))
              
              updateResult(item.id, { 
                status: 'analyzing',
                crawledContent: { content: crawlResponse.data.content }
              })

              const analysisResponse = await axios.post('/api/analyze', {
                url: item.url,
                content: crawlResponse.data.content,
                config: config
              }, {
                signal: controller.signal,
                timeout: 60000
              })

              if (stopRequestedRef.current) return

              if (analysisResponse.data.success) {
                updateResult(item.id, {
                  status: 'completed',
                  result: analysisResponse.data.result,
                  reason: analysisResponse.data.reason,
                  crawledContent: { content: crawlResponse.data.content }
                })
              } else {
                updateResult(item.id, { 
                  status: 'analysis-failed',
                  error: analysisResponse.data.error,
                  crawledContent: { content: crawlResponse.data.content }
                })
              }
            } else {
              updateResult(item.id, { 
                status: 'crawl-failed',
                error: crawlResponse.data.error 
              })
            }

          } catch (error) {
            if (!stopRequestedRef.current) {
              if (axios.isCancel(error)) {
                updateResult(item.id, { status: 'waiting' })
              } else {
                updateResult(item.id, { 
                  status: 'failed',
                  error: error instanceof Error ? error.message : '未知错误'
                })
              }
            }
          } finally {
            completed++
            setAnalysisProgress(prev => ({ ...prev, current: completed }))
          }
        })

        await Promise.all(batchPromises)
        setProgress(Math.min(i + concurrency, pendingItems.length), pendingItems.length)
        
        if (i + concurrency < pendingItems.length && !stopRequestedRef.current) {
          const delay = config.concurrencySettings?.delayBetweenRequests || 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      if (!stopRequestedRef.current) {
        toast.success('分析完成')
      } else {
        toast.info('分析已停止')
      }
    } catch (error) {
      if (!stopRequestedRef.current) {
        toast.error('分析过程中发生错误')
      }
    } finally {
      setAnalyzing(false)
      setIsStopRequested(false)
      stopRequestedRef.current = false
      setCurrentAnalysisControllers([])
      
      setAnalysisProgress({
        current: 0,
        total: 0,
        isActive: false,
        currentUrl: '',
        stage: ''
      })
    }
  }

  // 停止分析
  const handleStopAnalysis = () => {
    console.log('Stopping analysis...')
    setIsStopRequested(true)
    stopRequestedRef.current = true
    
    // 强制中止所有控制器
    currentAnalysisControllers.forEach(controller => {
      try {
        controller.abort()
      } catch (error) {
        console.log('Error aborting controller:', error)
      }
    })
    
    // 立即将所有进行中的任务状态重置
    analysisData.forEach(item => {
      if (item.status === 'crawling' || item.status === 'analyzing' || item.status === 'info-crawling') {
        updateResult(item.id, { status: 'waiting' })
      }
    })
    
    setAnalyzing(false)
    setCurrentAnalysisControllers([])
    
    toast.success('已停止分析')
  }

  // 停止后台任务
  const handleStopBackgroundTask = async () => {
    if (!backgroundTask.taskId) return

    try {
      const response = await fetch('/api/background-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          taskId: backgroundTask.taskId
        })
      })

      if (response.ok) {
        toast.success('后台任务已取消')
        stopBackgroundTaskMonitoring()
        await loadAnalysisData(currentPage, itemsPerPage)
      } else {
        toast.error('取消后台任务失败')
      }
    } catch (error) {
      toast.error('取消后台任务失败')
      console.error('取消后台任务失败:', error)
    }
  }

  // 爬取单个网站的详细信息
  const handleCrawlCompanyInfo = async (id: string, url: string, controller?: AbortController) => {
    try {
      // 检查停止状态
      if (stopRequestedRef.current) {
        updateResult(id, { status: 'completed' })
        return
      }

      updateResult(id, { status: 'info-crawling' })
      
      // 使用AI提取邮箱信息
      const emailResponse = await axios.post('/api/extract-emails', {
        content: analysisData.find(item => item.id === id)?.crawledContent?.content || '',
        config
      }, {
        signal: controller?.signal,
        timeout: 30000
      })

      // 再次检查停止状态
      if (stopRequestedRef.current) {
        updateResult(id, { status: 'completed' })
        return
      }

      updateResult(id, {
        status: 'completed',
        emails: emailResponse.data.emails,
        hasInfoCrawled: true
      })

      toast.success('信息爬取完成')
    } catch (error) {
      if (axios.isCancel(error) || stopRequestedRef.current) {
        updateResult(id, { status: 'completed' })
        console.log(`Info crawling cancelled for ${url}`)
        return
      }

      updateResult(id, {
        status: 'info-crawl-failed',
        error: error instanceof Error ? error.message : '爬取失败'
      })
      toast.error('信息爬取失败')
    }
  }

  // 一键爬取所有Y结果的信息
  const handleCrawlAllYResults = async () => {
    const yResults = analysisData.filter(item => 
      item.result === 'Y' && !item.hasInfoCrawled
    )

    if (yResults.length === 0) {
      toast.error('没有需要爬取信息的网站')
      return
    }

    if (!config.apiKey) {
      toast.error('请先配置AI API密钥')
      return
    }

    const controllers: AbortController[] = []
    setCurrentAnalysisControllers(controllers)
    setAnalyzing(true)
    setIsStopRequested(false)
    stopRequestedRef.current = false  // 确保重置停止状态

    // 初始化进度监控
    setAnalysisProgress({
      current: 0,
      total: yResults.length,
      isActive: true,
      currentUrl: '',
      stage: 'preparing'
    })

    try {
      const concurrency = config.concurrencySettings?.enabled ? 
        (config.concurrencySettings?.maxConcurrent || 3) : 1

      let completed = 0

      for (let i = 0; i < yResults.length; i += concurrency) {
        if (stopRequestedRef.current) {
          console.log('Info crawling stopped by user request')
          break
        }

        const batch = yResults.slice(i, i + concurrency)
        
        const batchPromises = batch.map(async (item) => {
          if (stopRequestedRef.current) {
            console.log(`Skipping info crawling for ${item.url} due to stop request`)
            return
          }

          const controller = new AbortController()
          controllers.push(controller)

          try {
            // 更新当前处理的URL和阶段
            setAnalysisProgress(prev => ({
              ...prev,
              currentUrl: item.url,
              stage: 'info-crawling'
            }))
            
            await handleCrawlCompanyInfo(item.id, item.url, controller)
            
            completed++
            setAnalysisProgress(prev => ({ ...prev, current: completed }))
          } catch (error) {
            if (!stopRequestedRef.current) {
              console.error('Crawl info error:', error)
            }
            completed++
            setAnalysisProgress(prev => ({ ...prev, current: completed }))
          }
        })

        await Promise.all(batchPromises)
        
        if (i + concurrency < yResults.length && !stopRequestedRef.current) {
          const delay = config.concurrencySettings?.delayBetweenRequests || 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      if (!stopRequestedRef.current) {
        toast.success(`已完成 ${yResults.length} 个网站的信息爬取`)
      } else {
        toast.info('信息爬取已停止')
      }
    } catch (error) {
      if (!stopRequestedRef.current) {
        toast.error('批量爬取失败')
      }
    } finally {
      setAnalyzing(false)
      setIsStopRequested(false)
      stopRequestedRef.current = false
      setCurrentAnalysisControllers([])
      
      // 结束进度监控
      setAnalysisProgress({
        current: 0,
        total: 0,
        isActive: false,
        currentUrl: '',
        stage: ''
      })
    }
  }

  // 状态文本映射
  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting': return '等待分析'
      case 'crawling': return '正在爬取'
      case 'analyzing': return '正在分析'
      case 'info-crawling': return '正在爬取信息'
      case 'completed': return '已完成'
      case 'failed': return '失败'
      case 'crawl-failed': return '爬取失败'
      case 'analysis-failed': return 'AI分析失败'
      case 'info-crawl-failed': return '信息爬取失败'
      default: return '未知状态'
    }
  }

  // 错误类型文本映射
  const getErrorTypeText = (errorType?: string) => {
    switch (errorType) {
      case 'crawl_error': return '网站爬取错误'
      case 'ai_error': return 'AI分析错误'
      case 'network_error': return '网络连接错误'
      case 'timeout_error': return '请求超时错误'
      case 'config_error': return '配置错误'
      case 'unknown_error': return '未知错误'
      default: return '错误'
    }
  }

  // 格式化邮箱信息
  const formatEmails = (emails?: any[]) => {
    if (!emails || emails.length === 0) return '无'
    
    if (emails.length === 1) {
      const email = emails[0]
      return typeof email === 'string' ? email : 
        `${email.email}${email.ownerName ? ` (${email.ownerName})` : ''}`
    }
    
    return `${emails.length} 个邮箱`
  }

  // 格式化公司信息
  const formatCompanyInfo = (companyInfo?: any) => {
    if (!companyInfo) return '无'
    
    if (typeof companyInfo === 'string') return companyInfo
    
    return companyInfo.primaryName || companyInfo.names?.[0] || '无'
  }

  // 切换展开状态
  const toggleReasonExpansion = (id: string) => {
    const newExpanded = new Set(expandedReasons)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedReasons(newExpanded)
  }

  const toggleEmailExpansion = (id: string) => {
    const newExpanded = new Set(expandedEmails)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedEmails(newExpanded)
  }

  // 停止所有分析
  const handleStopAllAnalysis = () => {
    console.log('Stopping all analysis...')
    setIsStopRequested(true)
    stopRequestedRef.current = true
    
    // 强制中止所有控制器
    currentAnalysisControllers.forEach(controller => {
      try {
        controller.abort()
      } catch (error) {
        console.log('Error aborting controller:', error)
      }
    })
    
    // 立即清空控制器数组
    setCurrentAnalysisControllers([])
    
    // 立即将所有进行中的任务状态重置为等待
    analysisData.forEach(item => {
      if (item.status === 'crawling' || item.status === 'analyzing' || item.status === 'info-crawling') {
        updateResult(item.id, { status: 'waiting' })
      }
    })
    
    // 立即停止分析状态
    setAnalyzing(false)
    
    toast.success('已强制停止所有分析任务')
  }

  // 新增：获取阶段文本
  const getStageText = (stage: string) => {
    switch (stage) {
      case 'preparing': return '准备中'
      case 'crawling': return '爬取中'
      case 'analyzing': return '分析中'
      case 'info-crawling': return '爬取信息中'
      default: return '未知阶段'
    }
  }

  // 爬取选中项目的邮箱信息
  const handleCrawlSelectedEmails = async () => {
    if (selectedIds.length === 0) {
      toast.error('请先选择要爬取邮箱的项目')
      return
    }

    // 筛选出可以爬取邮箱的项目（去掉Y/N限制）
    const selectedItems = analysisData.filter(item => 
      selectedIds.includes(item.id) && 
      !item.hasInfoCrawled &&
      item.status === 'completed'
    )

    if (selectedItems.length === 0) {
      toast.error('选中的项目中没有可以爬取邮箱的网站（需要是未爬取过信息的已完成项目）')
      return
    }

    if (!config.apiKey) {
      toast.error('请先配置AI API密钥')
      return
    }

    const controllers: AbortController[] = []
    setCurrentAnalysisControllers(controllers)
    setAnalyzing(true)
    setIsStopRequested(false)
    stopRequestedRef.current = false

    // 初始化进度监控
    setAnalysisProgress({
      current: 0,
      total: selectedItems.length,
      isActive: true,
      currentUrl: '',
      stage: 'preparing'
    })

    try {
      const concurrency = config.concurrencySettings?.enabled ? 
        (config.concurrencySettings?.maxConcurrent || 3) : 1

      let completed = 0

      for (let i = 0; i < selectedItems.length; i += concurrency) {
        if (stopRequestedRef.current) {
          console.log('Selected info crawling stopped by user request')
          break
        }

        const batch = selectedItems.slice(i, i + concurrency)
        
        const batchPromises = batch.map(async (item) => {
          if (stopRequestedRef.current) {
            console.log(`Skipping selected info crawling for ${item.url} due to stop request`)
            return
          }

          const controller = new AbortController()
          controllers.push(controller)

          try {
            // 更新当前处理的URL和阶段
            setAnalysisProgress(prev => ({
              ...prev,
              currentUrl: item.url,
              stage: 'info-crawling'
            }))
            
            await handleCrawlCompanyInfo(item.id, item.url, controller)
            
            completed++
            setAnalysisProgress(prev => ({ ...prev, current: completed }))
          } catch (error) {
            if (!stopRequestedRef.current) {
              console.error('Crawl selected info error:', error)
            }
            completed++
            setAnalysisProgress(prev => ({ ...prev, current: completed }))
          }
        })

        await Promise.all(batchPromises)
        
        if (i + concurrency < selectedItems.length && !stopRequestedRef.current) {
          const delay = config.concurrencySettings?.delayBetweenRequests || 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }

      if (!stopRequestedRef.current) {
        toast.success(`已完成 ${selectedItems.length} 个选中网站的邮箱爬取`)
        setSelectedIds([]) // 清空选择
      } else {
        toast.info('选中邮箱爬取已停止')
      }
    } catch (error) {
      if (!stopRequestedRef.current) {
        toast.error('批量爬取选中项目失败')
      }
    } finally {
      setAnalyzing(false)
      setIsStopRequested(false)
      stopRequestedRef.current = false
      setCurrentAnalysisControllers([])
      
      // 结束进度监控
      setAnalysisProgress({
        current: 0,
        total: 0,
        isActive: false,
        currentUrl: '',
        stage: ''
      })
    }
  }

  // 检查是否可以爬取选中项目的邮箱（去掉Y/N限制）
  const canCrawlSelectedEmails = selectedIds.some(id => {
    const item = analysisData.find(item => item.id === id)
    return item && !item.hasInfoCrawled && item.status === 'completed'
  })

  return (
    <Card>
      <CardHeader>
        {/* 进度监控单独区域 */}
        {analysisProgress.isActive && (
          <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                <div>
                  <div className="text-sm font-medium text-blue-900">
                    {getStageText(analysisProgress.stage)} - {analysisProgress.current}/{analysisProgress.total}
                  </div>
                  <div className="text-xs text-blue-700">
                    进度: {Math.round((analysisProgress.current / analysisProgress.total) * 100)}%
                  </div>
                </div>
              </div>
              
              <div className="flex-1 max-w-md mx-4">
                <Progress 
                  value={(analysisProgress.current / analysisProgress.total) * 100} 
                  className="h-2"
                />
              </div>
              
              {analysisProgress.currentUrl && (
                <div className="text-xs text-blue-600 max-w-xs truncate" title={analysisProgress.currentUrl}>
                  当前: {analysisProgress.currentUrl}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 后台任务监控区域 */}
        {backgroundTask.isMonitoring && (
          <div className="mb-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {backgroundTask.status === 'running' ? (
                    <Loader2 className="h-5 w-5 text-green-600 animate-spin" />
                  ) : backgroundTask.status === 'completed' ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : backgroundTask.status === 'failed' ? (
                    <XCircle className="h-5 w-5 text-red-600" />
                  ) : (
                    <Clock className="h-5 w-5 text-orange-600" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-green-900">
                      后台任务 - {backgroundTask.status === 'running' ? '运行中' : 
                                 backgroundTask.status === 'completed' ? '已完成' :
                                 backgroundTask.status === 'failed' ? '失败' : '等待中'}
                    </div>
                    <div className="text-xs text-green-700">
                      任务ID: {backgroundTask.taskId?.substring(0, 8)}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 max-w-md mx-4">
                <Progress 
                  value={backgroundTask.progress.total > 0 ? (backgroundTask.progress.current / backgroundTask.progress.total) * 100 : 0} 
                  className="h-2"
                />
              </div>
              
              <div className="flex items-center gap-3">
                {backgroundTask.summary && (
                  <div className="text-xs text-green-600">
                    完成: {backgroundTask.summary.completed} | 失败: {backgroundTask.summary.failed} | 剩余: {backgroundTask.summary.remaining}
                  </div>
                )}
                
                {backgroundTask.status === 'running' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStopBackgroundTask}
                    className="h-6 text-xs border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <StopCircle className="h-3 w-3 mr-1" />
                    取消
                  </Button>
                )}
              </div>
            </div>
            
            <div className="mt-2 text-xs text-green-600">
              💡 提示：后台任务会持续运行，即使关闭网页也不会中断
            </div>
          </div>
        )}

        {/* 表格标题和操作按钮区域 */}
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-blue-600" />
            分析结果
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {filteredData.length} / {totalCount} 个网站
            </Badge>
            {(filterStatus !== 'all' || filterResult !== 'all' || searchQuery.trim()) && (
              <Badge variant="secondary" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                <Filter className="h-3 w-3 mr-1" />
                已筛选
              </Badge>
            )}
          </CardTitle>
          
          {/* 操作按钮区域 */}
          <div className="flex items-center gap-2">
            {/* 分析控制按钮 */}
            {isAnalyzing ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStopAnalysis}
                  className="shadow-sm"
                >
                  <StopCircle className="h-4 w-4 mr-1" />
                  停止分析
                </Button>
                
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStopAllAnalysis}
                  className="shadow-sm"
                >
                  <StopCircle className="h-4 w-4 mr-1" />
                  强制停止
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleStartAnalysis}
                  disabled={!canStartAnalysis}
                  className="bg-blue-600 hover:bg-blue-700 shadow-sm"
                >
                  <Play className="h-4 w-4 mr-1" />
                  开始分析
                </Button>
                
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCrawlAllYResults}
                  disabled={!canCrawlAll}
                  className="shadow-sm"
                >
                  <PlayCircle className="h-4 w-4 mr-1" />
                  爬取信息
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCrawlSelectedEmails}
                  disabled={!canCrawlSelectedEmails}
                  className="shadow-sm border-purple-200 text-purple-600 hover:bg-purple-50"
                >
                  <Mail className="h-4 w-4 mr-1" />
                  爬取选中
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 搜索和筛选区域 */}
        <div className="flex items-center justify-between mt-6">
          <div className="flex items-center gap-3">
            {/* 搜索框 */}
            <Input
              placeholder="搜索网站地址、公司名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 shadow-sm"
            />

            {/* 筛选控制 */}
            <div className="flex items-center gap-2 border rounded-lg p-2 bg-white shadow-sm">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32 h-8 border-0 bg-transparent">
                  <SelectValue placeholder="状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="waiting">等待分析</SelectItem>
                  <SelectItem value="crawling">正在爬取</SelectItem>
                  <SelectItem value="analyzing">正在分析</SelectItem>
                  <SelectItem value="info-crawling">正在爬取信息</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="failed">失败</SelectItem>
                  <SelectItem value="crawl-failed">爬取失败</SelectItem>
                  <SelectItem value="analysis-failed">分析失败</SelectItem>
                  <SelectItem value="info-crawl-failed">信息爬取失败</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterResult} onValueChange={setFilterResult}>
                <SelectTrigger className="w-32 h-8 border-0 bg-transparent">
                  <SelectValue placeholder="结果" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部结果</SelectItem>
                  <SelectItem value="Y">是</SelectItem>
                  <SelectItem value="N">否</SelectItem>
                  <SelectItem value="ERROR">错误</SelectItem>
                  <SelectItem value="PENDING">待分析</SelectItem>
                </SelectContent>
              </Select>

              {(filterStatus !== 'all' || filterResult !== 'all' || searchQuery.trim()) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterStatus('all')
                    setFilterResult('all')
                    setSearchQuery('')
                  }}
                  className="h-6 px-2 text-xs"
                >
                  重置
                </Button>
              )}
            </div>
          </div>

          {/* 功能按钮区域 */}
          <div className="flex items-center gap-2">
            {/* 刷新按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>

            {/* 表格设置 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTableSettings(!showTableSettings)}
              className="shadow-sm"
            >
              <Settings className="h-4 w-4" />
            </Button>

            {/* 复制选中按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopySelected}
              disabled={selectedIds.length === 0}
              className="shadow-sm border-blue-200 text-blue-600 hover:bg-blue-50"
            >
              <Copy className="h-4 w-4 mr-1" />
              复制选中
            </Button>

            {/* 复制全部按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyData}
              disabled={filteredData.length === 0}
              className="shadow-sm"
            >
              <Copy className="h-4 w-4 mr-1" />
              全部复制
            </Button>

            {/* 导出菜单 */}
            <div className="relative group">
              <Button
                variant="outline"
                size="sm"
                disabled={filteredData.length === 0}
                className="shadow-sm"
              >
                <Download className="h-4 w-4 mr-1" />
                导出
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
              
              <div className="absolute right-0 mt-1 w-32 bg-white border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                <button
                  type="button"
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => handleExport('excel')}
                >
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => handleExport('csv')}
                >
                  CSV (.csv)
                </button>
                <button
                  type="button"
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
                  onClick={() => handleExport('json')}
                >
                  JSON (.json)
                </button>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0}
              className="shadow-sm border-red-200 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除选中
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={totalCount === 0}
              className="shadow-sm border-red-200 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              清空所有
            </Button>
          </div>
        </div>

        {/* 进度条 */}
        {isAnalyzing && analysisProgress.isActive && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">
                分析进度 - {getStageText(analysisProgress.stage)}
              </div>
              <div className="text-sm text-gray-600">
                {analysisProgress.current} / {analysisProgress.total}
              </div>
            </div>
            <Progress 
              value={(analysisProgress.current / analysisProgress.total) * 100} 
              className="h-2"
            />
            {analysisProgress.currentUrl && (
              <div className="text-xs text-gray-500 mt-1 truncate">
                正在处理: {analysisProgress.currentUrl}
              </div>
            )}
          </div>
        )}

        {/* 表格设置面板 */}
        {showTableSettings && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="text-sm font-medium mb-2">表格设置</div>
            <div className="space-y-2 text-sm">
              <div className="text-gray-600">
                • 当前显示: {hasLocalFilter ? '使用本地筛选' : '服务端分页'}
              </div>
              <div className="text-gray-600">
                • 每页显示: {itemsPerPage} 条记录
              </div>
              <div className="text-gray-600">
                • 总计: {totalCount} 条记录
              </div>
              {hasLocalFilter && (
                <div className="text-orange-600">
                  • 注意: 启用筛选时显示当前页的筛选结果
                </div>
              )}
            </div>
          </div>
        )}

        {/* 数据表格 */}
        <div className="mt-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>网站链接</TableHead>
                  <TableHead className="w-24">判断结果</TableHead>
                  <TableHead>判断依据</TableHead>
                  <TableHead>公司信息</TableHead>
                  <TableHead>邮箱信息</TableHead>
                  <TableHead className="w-32">状态</TableHead>
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(item.id)}
                          onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline max-w-xs truncate block"
                          title={item.url}
                        >
                          {item.url}
                        </a>
                      </TableCell>
                      <TableCell>{getResultBadge(item.result)}</TableCell>
                      <TableCell>
                        {item.reason && (
                          <div className="max-w-xs">
                            <div 
                              className={`${expandedReasons.has(item.id) ? 'whitespace-pre-wrap break-words' : 'line-clamp-2'} text-sm text-gray-600`}
                            >
                              {item.reason}
                            </div>
                            {item.reason.length > 100 && (
                              <div className="mt-1">
                                <button
                                  type="button"
                                  onClick={() => toggleReasonExpansion(item.id)}
                                  className="text-xs text-blue-600 hover:underline block"
                                >
                                  {expandedReasons.has(item.id) ? '收起' : '展开'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.companyInfo && (
                          <div className="text-sm">
                            <div className="font-medium">{formatCompanyInfo(item.companyInfo)}</div>
                            {item.companyInfo.founderNames?.length > 0 && (
                              <div className="text-gray-500 text-xs">
                                创始人: {item.companyInfo.founderNames.join(', ')}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {item.emails && item.emails.length > 0 && (
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              <span>{formatEmails(item.emails)}</span>
                            </div>
                            {item.emails.length > 1 && (
                              <button
                                type="button"
                                onClick={() => toggleEmailExpansion(item.id)}
                                className="text-xs text-blue-600 hover:underline mt-1"
                              >
                                {expandedEmails.has(item.id) ? '收起' : '查看详情'}
                              </button>
                            )}
                            {expandedEmails.has(item.id) && (
                              <div className="mt-2 space-y-1">
                                {item.emails.map((email, idx) => (
                                  <div key={idx} className="text-xs text-gray-600">
                                    {email.email}
                                    {email.ownerName && ` (${email.ownerName})`}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(item.status)}
                            <span className="text-sm">{getStatusText(item.status)}</span>
                          </div>
                          
                          {/* 显示详细错误信息 */}
                          {(item.status === 'failed' || item.status === 'crawl-failed' || item.status === 'analysis-failed' || item.status === 'info-crawl-failed') && item.errorDetails && (
                            <div className="mt-1">
                              <div className="text-xs bg-red-50 px-2 py-1 rounded border border-red-200 max-w-xs">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-red-800">
                                    {getErrorTypeText(item.errorDetails.type)}
                                  </span>
                                  <Badge 
                                    variant={item.errorDetails.retryable ? "secondary" : "destructive"} 
                                    className="text-xs px-1 py-0"
                                  >
                                    {item.errorDetails.retryable ? '可重试' : '不可重试'}
                                  </Badge>
                                </div>
                                <div className="text-red-600 break-words">
                                  阶段: {item.errorDetails.stage === 'crawling' ? '网站爬取' : 
                                        item.errorDetails.stage === 'ai_analysis' ? 'AI分析' : 
                                        item.errorDetails.stage === 'info_extraction' ? '信息提取' : '初始化'}
                                </div>
                                <div className="text-red-600 break-words mt-1">
                                  {item.errorDetails.message}
                                </div>
                                {item.errorDetails.statusCode && (
                                  <div className="text-red-500 text-xs mt-1">
                                    状态码: {item.errorDetails.statusCode}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* 兼容旧的错误显示 */}
                          {(item.status === 'failed' || item.status === 'crawl-failed' || item.status === 'analysis-failed' || item.status === 'info-crawl-failed') && !item.errorDetails && item.error && (
                            <div className="mt-1">
                              <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded border border-red-200 max-w-xs">
                                <div className="font-medium mb-1">错误信息:</div>
                                <div className="break-words">{item.error}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.result === 'Y' && !item.hasInfoCrawled && item.status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCrawlCompanyInfo(item.id, item.url)}
                            disabled={isAnalyzing}
                          >
                            <Mail className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 分页控制 */}
          {!hasLocalFilter && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                显示 {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} 条，
                共 {totalCount} 条
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {(() => {
                  const pages = []
                  const startPage = Math.max(1, currentPage - 2)
                  const endPage = Math.min(totalPages, startPage + 4)
                  
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <Button
                        key={`page-${i}`}
                        variant={currentPage === i ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(i)}
                      >
                        {i}
                      </Button>
                    )
                  }
                  return pages
                })()}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* 本地筛选时的提示 */}
          {hasLocalFilter && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                当前筛选显示 {filteredData.length} 条记录（来自第 {currentPage} 页的 {analysisData.length} 条记录）
              </div>
              <div className="text-xs text-orange-600">
                筛选仅应用于当前页数据
              </div>
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  )
} 