'use client'

import { useState, useEffect } from 'react'
import { UrlInput } from '@/components/url-input'
import { AnalysisTable } from '@/components/analysis-table'
import { FailedDataManager } from '@/components/failed-data-manager'
import { Brain, Globe, Settings, CheckCircle, XCircle, AlertTriangle, Wifi, WifiOff, Loader2 } from 'lucide-react'
import { useStore } from '@/store/analysis-store'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

/**
 * @description AI网站内容分析系统主页
 */
export default function HomePage() {
	const { config, loadAnalysisData } = useStore()
	const [localConfig, setLocalConfig] = useState<any>(null)
	const [isTestingApi, setIsTestingApi] = useState(false)
	const [apiTestResult, setApiTestResult] = useState<{
		status: 'success' | 'error' | null
		message?: string
		responseTime?: number
	}>({ status: null })

	// 客户端渲染状态
	const [isClient, setIsClient] = useState(false)
	const [isDataLoaded, setIsDataLoaded] = useState(false)

	// 确保只在客户端执行并初始化数据
	useEffect(() => {
		setIsClient(true)
		
		// 初始化加载分析数据
		const initializeData = async () => {
			try {
				await loadAnalysisData()
				setIsDataLoaded(true)
			} catch (error) {
				console.error('初始化数据失败:', error)
				toast.error('加载数据失败，请刷新页面重试')
			}
		}
		
		initializeData()
	}, [loadAnalysisData])

	// 处理配置加载
	useEffect(() => {
		try {
			const storedData = localStorage.getItem('ai-analysis-config')
			if (storedData) {
				const parsedData = JSON.parse(storedData)
				if (parsedData.state?.config) {
					setLocalConfig(parsedData.state.config)
				}
			}
		} catch (error) {
			console.error('Failed to load config from localStorage:', error)
		}
	}, [])

	// API连接测试
	const testApiConnection = async () => {
		setIsTestingApi(true)
		const startTime = Date.now()
		
		try {
			const response = await fetch('/api/test-api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					config: localConfig || config
				})
			})
			
			const responseTime = Date.now() - startTime
			const result = await response.json()
			
			if (response.ok && result.success) {
				setApiTestResult({
					status: 'success',
					message: 'API连接正常',
					responseTime
				})
				toast.success(`API连接测试成功 (${responseTime}ms)`)
			} else {
				setApiTestResult({
					status: 'error',
					message: result.error || 'API连接失败'
				})
				toast.error(`API连接测试失败: ${result.error}`)
			}
		} catch (error) {
			setApiTestResult({
				status: 'error',
				message: error instanceof Error ? error.message : '连接错误'
			})
			toast.error(`API连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`)
		} finally {
			setIsTestingApi(false)
		}
	}

	// 获取配置状态
	const getConfigStatus = () => {
		const currentConfig = localConfig || config
		
		if (!isClient) {
			return {
				status: 'loading' as const,
				text: '加载中...',
				color: 'text-gray-500'
			}
		}
		
		const hasApiKey = !!(currentConfig?.apiKey?.trim())
		const hasApiUrl = !!(currentConfig?.apiUrl?.trim())
		const hasModel = !!(currentConfig?.modelName?.trim())
		
		if (hasApiKey && hasApiUrl && hasModel) {
			return {
				status: 'complete' as const,
				text: '已配置',
				color: 'text-green-600'
			}
		} else if (hasApiKey || hasApiUrl || hasModel) {
			return {
				status: 'partial' as const,
				text: '部分配置',
				color: 'text-orange-600'
			}
		} else {
			return {
				status: 'missing' as const,
				text: '未配置',
				color: 'text-red-600'
			}
		}
	}

	// 获取API测试图标
	const getApiTestIcon = () => {
		if (isTestingApi) return Loader2
		return apiTestResult.status === 'success' ? Wifi : apiTestResult.status === 'error' ? WifiOff : Settings
	}

	const configStatus = getConfigStatus()
	const currentConfig = localConfig || config
	const StatusIcon = configStatus.status === 'complete' ? CheckCircle : 
	                  configStatus.status === 'partial' ? AlertTriangle : XCircle
	const ApiTestIcon = getApiTestIcon()

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
			
			{/* Header */}
			<header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
				<div className="container mx-auto px-4 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-2">
								<Brain className="h-8 w-8 text-blue-600" />
								<Globe className="h-6 w-6 text-green-600" />
							</div>
							<div>
								<h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
									AI 网站内容分析系统
								</h1>
								<p className="text-sm text-muted-foreground">
									智能爬取网站内容并通过AI进行客户分析
								</p>
							</div>
						</div>
						
						<div className="flex items-center gap-4">
							{/* 配置状态显示 */}
							<Card className="px-4 py-3 bg-white/90 shadow-sm border-slate-200">
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
													isTestingApi ? 'animate-spin' :
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
									
									{/* 配置详情显示 */}
									<div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
										<span className="flex items-center gap-1">
											<div className={`w-2 h-2 rounded-full ${isClient && currentConfig?.proxySettings?.enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
											代理: {isClient && currentConfig?.proxySettings?.enabled ? '启用' : '禁用'}
										</span>
										<span className="flex items-center gap-1">
											<div className={`w-2 h-2 rounded-full ${isClient && currentConfig?.concurrencySettings?.enabled ? 'bg-blue-500' : 'bg-gray-300'}`} />
											并发: {isClient && currentConfig?.concurrencySettings?.enabled ? `${currentConfig?.concurrencySettings?.maxConcurrent}` : '禁用'}
										</span>
										<span className="flex items-center gap-1">
											<div className={`w-2 h-2 rounded-full ${isClient && currentConfig?.antiDetectionSettings?.enabled ? 'bg-purple-500' : 'bg-gray-300'}`} />
											反检测: {isClient && currentConfig?.antiDetectionSettings?.enabled ? '启用' : '禁用'}
										</span>
									</div>
								</CardContent>
							</Card>
							
							<Button
								variant="outline"
								size="sm"
								asChild
								className="shadow-sm"
							>
								<a 
									href="/config" 
									className="flex items-center gap-2"
								>
									<Settings className="h-4 w-4" />
									配置管理
								</a>
							</Button>
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

					{/* Analysis Results Section */}
					<section>
						<AnalysisTable />
					</section>

					{/* Failed Data Manager Section */}
					<section>
						<FailedDataManager />
					</section>
				</div>
			</main>

			{/* Footer */}
			<footer className="border-t bg-white/60 backdrop-blur-sm mt-16">
				<div className="container mx-auto px-4 py-6">
					<div className="text-center text-sm text-muted-foreground">
						<p className="font-medium">AI 网站内容分析系统</p>
						<p className="mt-1">
							支持批量网站爬取、AI智能分析、数据导出等功能 • 基于 Next.js 构建
						</p>
					</div>
				</div>
			</footer>
		</div>
	)
}