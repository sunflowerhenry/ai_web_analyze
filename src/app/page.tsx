'use client'

import { useState, useEffect } from 'react'
import { UrlInput } from '@/components/url-input'
import { AnalysisTable } from '@/components/analysis-table'
import { Brain, Globe, Settings, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { useAnalysisStore } from '@/store/analysis-store'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

/**
 * @description 这只是个示例页面，你可以随意修改这个页面或进行全面重构
 */
export default function HomePage() {
	const { config } = useAnalysisStore()
	const [localConfig, setLocalConfig] = useState<any>(null)

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

	// 监听配置变化
	useEffect(() => {
		if (config) {
			console.log('HomePage: Config from Zustand:', config)
		}
	}, [config])

	// 使用 localConfig 或 config，优先使用已加载的配置
	const currentConfig = config || localConfig

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
							支持批量网站爬取、AI智能分析、数据导出等功能
						</p>
					</div>
				</div>
			</footer>
		</div>
	)
}
