'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Upload } from 'lucide-react'
import { useAnalysisStore } from '@/store/analysis-store'
import { toast } from 'sonner'

export function UrlInput() {
  const [inputText, setInputText] = useState('')
  const { addUrls } = useAnalysisStore()

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
      addUrls(validUrls)
      setInputText('')
      toast.success(`成功添加 ${validUrls.length} 个网站链接`)
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          添加网站链接
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
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleAddUrls} className="flex-1">
            <Plus className="h-4 w-4 mr-2" />
            添加链接
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
            当前输入了 {inputText.split('\n').filter(line => line.trim()).length} 个链接
          </div>
        )}
      </CardContent>
    </Card>
  )
} 