'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { 
  Trash2, 
  Download, 
  AlertTriangle, 
  Clock, 
  Server, 
  Copy,
  FileText,
  RefreshCw,
  FolderOpen
} from 'lucide-react'
import { toast } from 'sonner'
import axios from 'axios'
import { useStore } from '@/store/analysis-store'

interface FailedAnalysisData {
  id: string
  url: string
  timestamp: string
  stage: string
  errorType: string
  errorMessage: string
  requestData?: any
  responseData?: any
  stackTrace?: string
  userAgent?: string
  proxyUsed?: string
  configUsed?: any
}

export function FailedDataManager() {
  const [failedData, setFailedData] = useState<FailedAnalysisData[]>([])
  const [loading, setLoading] = useState(false)
  const [filePath, setFilePath] = useState('')
  const { isAnalyzing } = useStore()
  
  // 加载失败数据
  const loadFailedData = async () => {
    setLoading(true)
    try {
      const response = await axios.get('/api/failed-data')
      if (response.data.success) {
        setFailedData(response.data.data)
        setFilePath(response.data.filePath)
      }
    } catch (error) {
      toast.error('加载失败数据时发生错误')
      console.error('Failed to load failed data:', error)
    } finally {
      setLoading(false)
    }
  }

  // 初始加载一次
  useEffect(() => {
    loadFailedData()
  }, [])

  // 删除单个失败数据
  const handleDeleteSingle = async (id: string) => {
    try {
      const response = await axios.delete(`/api/failed-data?id=${id}`)
      if (response.data.success) {
        toast.success('失败数据已删除')
        await loadFailedData()
      }
    } catch (error) {
      toast.error('删除失败数据时发生错误')
      console.error('Failed to delete failed data:', error)
    }
  }

  // 清空所有失败数据
  const handleClearAll = async () => {
    if (!confirm('确定要清空所有失败数据吗？此操作不可撤销。')) {
      return
    }
    
    try {
      const response = await axios.delete('/api/failed-data?all=true')
      if (response.data.success) {
        toast.success('所有失败数据已清空')
        await loadFailedData()
      }
    } catch (error) {
      toast.error('清空失败数据时发生错误')
      console.error('Failed to clear failed data:', error)
    }
  }

  // 导出失败数据
  const handleExport = () => {
    if (failedData.length === 0) {
      toast.error('没有失败数据可导出')
      return
    }

    const dataToExport = failedData.map(item => ({
      ID: item.id,
      网站地址: item.url,
      失败时间: new Date(item.timestamp).toLocaleString('zh-CN'),
      失败阶段: getStageText(item.stage),
      错误类型: getErrorTypeText(item.errorType),
      错误信息: item.errorMessage,
      用户代理: item.userAgent,
      使用代理: item.proxyUsed || '无',
      请求数据: JSON.stringify(item.requestData, null, 2),
      响应数据: JSON.stringify(item.responseData, null, 2),
      堆栈跟踪: item.stackTrace || '无'
    }))

    const jsonContent = JSON.stringify(dataToExport, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `失败数据_${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    toast.success('失败数据已导出')
  }

  // 复制文件路径
  const handleCopyPath = () => {
    navigator.clipboard.writeText(filePath).then(() => {
      toast.success('文件路径已复制到剪贴板')
    }).catch(() => {
      toast.error('复制路径失败')
    })
  }

  // 获取阶段文本
  const getStageText = (stage: string) => {
    switch (stage) {
      case 'crawling': return '网站爬取'
      case 'analyzing': return 'AI分析'
      case 'info-crawling': return '信息爬取'
      default: return stage
    }
  }

  // 获取错误类型文本
  const getErrorTypeText = (errorType: string) => {
    switch (errorType) {
      case 'crawl_error': return '爬取错误'
      case 'auth_error': return '认证错误'
      case 'rate_limit_error': return '频率限制'
      case 'timeout_error': return '超时错误'
      case 'network_error': return '网络错误'
      case 'unknown_error': return '未知错误'
      default: return errorType
    }
  }

  // 获取错误类型徽章
  const getErrorTypeBadge = (errorType: string) => {
    switch (errorType) {
      case 'crawl_error': return <Badge variant="destructive" className="bg-red-500">爬取错误</Badge>
      case 'auth_error': return <Badge variant="destructive" className="bg-orange-500">认证错误</Badge>
      case 'rate_limit_error': return <Badge variant="secondary" className="bg-yellow-500">频率限制</Badge>
      case 'timeout_error': return <Badge variant="outline" className="bg-purple-500 text-white">超时错误</Badge>
      case 'network_error': return <Badge variant="outline" className="bg-blue-500 text-white">网络错误</Badge>
      default: return <Badge variant="outline">{getErrorTypeText(errorType)}</Badge>
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            失败数据管理
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
              {failedData.length} 条记录
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadFailedData}
              disabled={loading}
              className="shadow-sm"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新数据
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={failedData.length === 0}
              className="shadow-sm"
            >
              <Download className="h-4 w-4 mr-1" />
              导出
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={failedData.length === 0}
              className="shadow-sm border-red-200 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              清空所有
            </Button>
          </div>
        </CardTitle>
        
        {/* 文件路径信息 */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Server className="h-4 w-4" />
          <span>存储位置:</span>
          <code className="px-2 py-1 bg-muted rounded text-xs font-mono">{filePath}</code>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyPath}
            className="h-6 px-2"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const folderPath = filePath.substring(0, filePath.lastIndexOf('/'))
              toast.info(`请在文件管理器中打开: ${folderPath}`)
            }}
            className="h-6 px-2"
          >
            <FolderOpen className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>加载中...</span>
          </div>
        ) : failedData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>暂无失败数据</p>
            <p className="text-sm">分析失败时会自动记录到这里</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>网站地址</TableHead>
                  <TableHead className="w-32">失败时间</TableHead>
                  <TableHead className="w-24">阶段</TableHead>
                  <TableHead className="w-32">错误类型</TableHead>
                  <TableHead>错误信息</TableHead>
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedData.map((item) => (
                  <TableRow key={item.id}>
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
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(item.timestamp).toLocaleString('zh-CN')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getStageText(item.stage)}</Badge>
                    </TableCell>
                    <TableCell>
                      {getErrorTypeBadge(item.errorType)}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md">
                        <p className="text-sm text-red-600 line-clamp-2" title={item.errorMessage}>
                          {item.errorMessage}
                        </p>
                        {item.stackTrace && (
                          <details className="mt-1">
                            <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                              查看堆栈跟踪
                            </summary>
                            <pre className="text-xs text-gray-600 mt-1 p-2 bg-gray-50 rounded overflow-auto max-h-32">
                              {item.stackTrace}
                            </pre>
                          </details>
                        )}
                        {(item.requestData || item.responseData) && (
                          <details className="mt-1">
                            <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                              查看请求/响应数据
                            </summary>
                            <div className="text-xs text-gray-600 mt-1 p-2 bg-gray-50 rounded max-h-32 overflow-auto">
                              {item.requestData && (
                                <div className="mb-2">
                                  <strong>请求数据:</strong>
                                  <pre>{JSON.stringify(item.requestData, null, 2)}</pre>
                                </div>
                              )}
                              {item.responseData && (
                                <div>
                                  <strong>响应数据:</strong>
                                  <pre>{JSON.stringify(item.responseData, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteSingle(item.id)}
                        className="text-red-600 hover:bg-red-50 border-red-200"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 