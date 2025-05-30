'use client'

import { useState, useEffect } from 'react'
import { UrlInput } from '@/components/url-input'
import { AnalysisTable } from '@/components/analysis-table'
import { BackgroundTaskMonitor } from '@/components/background-task-monitor'
import { Brain, Globe, Settings, CheckCircle, XCircle, AlertTriangle, Wifi, WifiOff } from 'lucide-react'
import { useAnalysisStore } from '@/store/analysis-store'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

/**
 * @description 这只是个示例页面，你可以随意修改这个页面或进行全面重构
 */
export default function HomePage() {
	const { config, backgroundTasks, syncBackgroundTaskResults, removeBackgroundTask } = useAnalysisStore()
	const [localConfig, setLocalConfig] = useState<any>(null)
	const [isTestingApi, setIsTestingApi] = useState(false)
	const [apiTestResult, setApiTestResult] = useState<{
		status: 'success' | 'error' | null
		message?: string
		responseTime?: number
	}>({ status: null })

	// 恢复的任务监控
	const startResumedTaskMonitoring = (taskId: string) => {
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
					await syncRealtimeStatus(statusData)
					
					if (statusData.status === 'completed') {
						clearInterval(monitorInterval)
						await syncBackgroundTaskResults(taskId)
						removeBackgroundTask(taskId)
						toast.success(`后台任务 ${taskId.substring(0, 8)} 已完成`)
					} else if (statusData.status === 'failed') {
						clearInterval(monitorInterval)
						await syncBackgroundTaskResults(taskId)
						removeBackgroundTask(taskId)
						toast.error(`后台任务 ${taskId.substring(0, 8)} 失败`)
					}
				}
			} catch (error) {
				console.error('监控恢复任务状态失败:', error)
			}
		}, 2000) // 每2秒检查一次

		// 10分钟后停止监控
		setTimeout(() => clearInterval(monitorInterval), 600000)
	}

	// 同步实时状态到前端
	const syncRealtimeStatus = async (statusData: any) => {
		const { updateResult, analysisData, addUrls } = useAnalysisStore.getState()
		
		// 确保所有URL都已添加到分析数据中
		const existingUrls = new Set(analysisData.map(item => item.url))
		const allUrls = [
			...statusData.recentResults?.map((r: any) => r.url) || [],
			...statusData.recentErrors?.map((e: any) => e.url) || [],
			...statusData.currentlyProcessing || []
		]
		
		const newUrls = allUrls.filter(url => url && !existingUrls.has(url))
		if (newUrls.length > 0) {
			console.log('添加缺失的URL到分析数据:', newUrls)
			addUrls(newUrls)
		}
		
		// 等待状态更新
		await new Promise(resolve => setTimeout(resolve, 100))
		
		// 获取最新的分析数据
		const latestAnalysisData = useAnalysisStore.getState().analysisData
		
		// 更新正在处理的URL状态
		if (statusData.currentlyProcessing && statusData.currentlyProcessing.length > 0) {
			statusData.currentlyProcessing.forEach((url: string) => {
				const existingItem = latestAnalysisData.find(item => item.url === url)
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
				const existingItem = latestAnalysisData.find(item => item.url === result.url)
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
				const existingItem = latestAnalysisData.find(item => item.url === error.url)
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

	// 处理配置加载
	useEffect(() => {
		// 直接从 localStorage 读取配置
		try {
			const storedData = localStorage.getItem('analysis-store')
			if (storedData) {
				const parsedData = JSON.parse(storedData)
				if (parsedData.state?.config) {
					setLocalConfig(parsedData.state.config)
					console.log('HomePage: Loaded config from localStorage:', parsedData.state.config)
				}
			}
		} catch (error) {
			console.error('Failed to load config from localStorage:', error)
		}
	}, [])

	// 页面加载时检查并恢复后台任务
	useEffect(() => {
		const checkBackgroundTasks = async () => {
			if (backgroundTasks && backgroundTasks.length > 0) {
				console.log('检查后台任务:', backgroundTasks)
				
				for (const taskId of backgroundTasks) {
					try {
						// 使用realtime-status API获取详细状态
						const response = await fetch('/api/background-task', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								action: 'realtime-status',
								taskId
							})
						})
						
						if (response.ok) {
							const taskStatus = await response.json()
							console.log(`任务 ${taskId} 状态:`, taskStatus)
							
							if (taskStatus.status === 'completed') {
								// 同步已完成的任务结果
								await syncBackgroundTaskResults(taskId)
								removeBackgroundTask(taskId)
								toast.success(`后台任务 ${taskId.substring(0, 8)} 已完成`, {
									description: `已同步 ${taskStatus.summary.completed} 个结果`
								})
							} else if (taskStatus.status === 'failed') {
								// 同步失败的任务结果
								await syncBackgroundTaskResults(taskId)
								removeBackgroundTask(taskId)
								toast.error(`后台任务 ${taskId.substring(0, 8)} 失败`)
							} else if (taskStatus.status === 'running' || taskStatus.status === 'pending') {
								// 首先同步当前状态
								await syncRealtimeStatus(taskStatus)
								
								// 继续监控正在运行的任务
								toast.info(`发现正在运行的后台任务 ${taskId.substring(0, 8)}`, {
									description: `进度: ${taskStatus.progress.current}/${taskStatus.progress.total}`
								})
								
								// 启动实时监控
								startResumedTaskMonitoring(taskId)
							}
						} else {
							// 任务不存在，从列表中移除
							console.log(`任务 ${taskId} 不存在，从列表中移除`)
							removeBackgroundTask(taskId)
						}
					} catch (error) {
						console.error('检查后台任务失败:', error)
					}
				}
			} else {
				console.log('没有发现后台任务')
			}
		}
		
		// 页面加载后1秒开始检查，给存储状态恢复一些时间
		const timer = setTimeout(checkBackgroundTasks, 1000)
		return () => clearTimeout(timer)
	}, [backgroundTasks, syncBackgroundTaskResults, removeBackgroundTask])

	// 监听配置变化
	useEffect(() => {
		if (config) {
			console.log('HomePage: Config from Zustand:', config)
		}
	}, [config])

	// 使用 localConfig 或 config，优先使用已加载的配置
	const currentConfig = config || localConfig

	// API测试功能
	const testApiConnection = async () => {
		if (!currentConfig?.apiKey || !currentConfig?.apiUrl || !currentConfig?.modelName) {
			toast.error('请先完成AI配置')
			return
		}

		setIsTestingApi(true)
		setApiTestResult({ status: null })

		try {
			const response = await fetch('/api/test-api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					config: {
						apiKey: currentConfig.apiKey,
						apiUrl: currentConfig.apiUrl,
						modelName: currentConfig.modelName
					}
				})
			})

			const result = await response.json()

			if (result.status === 'success') {
				setApiTestResult({
					status: 'success',
					message: result.message,
					responseTime: result.responseTime
				})
				toast.success(`API连接成功！响应时间: ${result.responseTime}ms`)
			} else {
				setApiTestResult({
					status: 'error',
					message: result.message
				})
				toast.error(`API测试失败: ${result.message}`)
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'API测试失败'
			setApiTestResult({
				status: 'error',
				message: errorMessage
			})
			toast.error(`API测试失败: ${errorMessage}`)
		} finally {
			setIsTestingApi(false)
		}
	}

	// 检查配置状态
	const getConfigStatus = () => {
		const hasApiKey = !!currentConfig?.apiKey?.trim()
		const hasApiUrl = !!currentConfig?.apiUrl?.trim()
		const hasModel = !!currentConfig?.modelName?.trim()
		
		console.log('HomePage: Config status check:', {
			hasApiKey,
			hasApiUrl,
			hasModel,
			apiKey: currentConfig?.apiKey ? '***' : 'empty',
			apiUrl: currentConfig?.apiUrl,
			modelName: currentConfig?.modelName
		})
		
		if (hasApiKey && hasApiUrl && hasModel) {
			return { status: 'complete', text: '已配置', icon: CheckCircle, color: 'text-green-600' }
		} else if (hasApiKey || hasApiUrl || hasModel) {
			return { status: 'partial', text: '部分配置', icon: AlertTriangle, color: 'text-yellow-600' }
		} else {
			return { status: 'none', text: '未配置', icon: XCircle, color: 'text-red-600' }
		}
	}

	const configStatus = getConfigStatus()
	const StatusIcon = configStatus.icon

	// API测试状态图标
	const getApiTestIcon = () => {
		if (apiTestResult.status === 'success') return Wifi
		if (apiTestResult.status === 'error') return WifiOff
		return Wifi
	}

	const ApiTestIcon = getApiTestIcon()

	return (
		<div className="min-h-screen bg-background">
			
			{/* Header */}
			<header className="border-b bg-white/50 backdrop-blur-sm sticky top-0 z-50">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="flex items-center gap-2">
								<Brain className="h-8 w-8 text-blue-600" />
								<Globe className="h-6 w-6 text-green-600" />
							</div>
							<div>
								<h1 className="text-2xl font-bold">AI 网站内容分析系统</h1>
								<p className="text-sm text-muted-foreground">
									智能爬取网站内容并通过AI进行客户分析
								</p>
							</div>
						</div>
						
						<div className="flex items-center gap-4">
							{/* 配置状态显示 */}
							<Card className="px-3 py-2">
								<CardContent className="p-0">
									<div className="flex items-center gap-2">
										<StatusIcon className={`h-4 w-4 ${configStatus.color}`} />
										<span className="text-sm font-medium">AI配置</span>
										<Badge variant={configStatus.status === 'complete' ? 'default' : configStatus.status === 'partial' ? 'secondary' : 'destructive'}>
											{configStatus.text}
										</Badge>
									</div>
									
									{/* API测试按钮和状态 */}
									{configStatus.status === 'complete' && (
										<div className="flex items-center gap-2 mt-2">
											<Button
												size="sm"
												variant="outline"
												onClick={testApiConnection}
												disabled={isTestingApi}
												className="h-6 text-xs"
											>
												<ApiTestIcon className={`h-3 w-3 mr-1 ${
													apiTestResult.status === 'success' ? 'text-green-600' : 
													apiTestResult.status === 'error' ? 'text-red-600' : 'text-gray-600'
												}`} />
												{isTestingApi ? '测试中...' : '测试API'}
											</Button>
											{apiTestResult.status && (
												<span className={`text-xs ${
													apiTestResult.status === 'success' ? 'text-green-600' : 'text-red-600'
												}`}>
													{apiTestResult.status === 'success' ? 
														`连接正常 (${apiTestResult.responseTime}ms)` : 
														'连接失败'
													}
												</span>
											)}
										</div>
									)}
									
									<div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
										<span className="flex items-center gap-1">
											<div className={`w-2 h-2 rounded-full ${currentConfig?.proxySettings?.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
											代理: {currentConfig?.proxySettings?.enabled ? '启用' : '禁用'}
										</span>
										<span className="flex items-center gap-1">
											<div className={`w-2 h-2 rounded-full ${currentConfig?.concurrencySettings?.enabled ? 'bg-blue-500' : 'bg-gray-300'}`} />
											并发: {currentConfig?.concurrencySettings?.enabled ? `${currentConfig?.concurrencySettings?.maxConcurrent}` : '禁用'}
										</span>
										<span className="flex items-center gap-1">
											<div className={`w-2 h-2 rounded-full ${currentConfig?.antiDetectionSettings?.enabled ? 'bg-purple-500' : 'bg-gray-300'}`} />
											反检测: {currentConfig?.antiDetectionSettings?.enabled ? '启用' : '禁用'}
										</span>
									</div>
								</CardContent>
							</Card>
							
							<a 
								href="/config" 
								className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
							>
								<Settings className="h-4 w-4" />
								配置管理
							</a>
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="container mx-auto px-4 py-8">
				<div className="grid gap-8">
					{/* URL Input Section */}
					<section>
						<UrlInput />
					</section>

					{/* Background Task Monitor Section */}
					<section>
						<BackgroundTaskMonitor />
					</section>

					{/* Analysis Results Section */}
					<section>
						<AnalysisTable />
					</section>
				</div>
			</main>

			{/* Footer */}
			<footer className="border-t bg-muted/30 mt-16">
				<div className="container mx-auto px-4 py-6">
					<div className="text-center text-sm text-muted-foreground">
						<p>AI 网站内容分析系统 - 基于 Next.js 构建</p>
						<p className="mt-1">
							支持批量网站爬取、AI智能分析、数据导出、后台任务等功能
						</p>
					</div>
				</div>
			</footer>
		</div>
	)
}
