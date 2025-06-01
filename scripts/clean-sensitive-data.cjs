#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

// 敏感数据模式
const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{48}/g, // OpenAI API keys
  /sk-[a-zA-Z0-9-_]{20,}/g, // 其他可能的密钥格式
  /"apiKey"\s*:\s*"[^"]+"/g, // JSON中的apiKey字段
  /apiKey\s*=\s*['"][^'"]+['"]/g, // 配置文件中的apiKey
  /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g, // Bearer tokens
  /key[_-]?[a-zA-Z0-9]{10,}/gi, // 通用密钥模式
]

// 需要清理的目录和文件
const TARGET_PATHS = [
  'data/',
  '.next/',
  'node_modules/.cache/',
  'logs/',
  'tmp/',
  'temp/'
]

function cleanSensitiveData(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8')
    let cleaned = false
    
    SENSITIVE_PATTERNS.forEach(pattern => {
      if (pattern.test(content)) {
        content = content.replace(pattern, match => {
          cleaned = true
          if (match.includes('apiKey')) {
            return match.replace(/[^"':=\s]+$/, '""')
          }
          return '"[REDACTED]"'
        })
      }
    })
    
    if (cleaned) {
      fs.writeFileSync(filePath, content, 'utf8')
      console.log(`✅ 清理了文件: ${filePath}`)
      return true
    }
    
    return false
  } catch (error) {
    console.log(`❌ 无法处理文件 ${filePath}: ${error.message}`)
    return false
  }
}

function cleanDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return
  }
  
  const items = fs.readdirSync(dirPath)
  
  items.forEach(item => {
    const fullPath = path.join(dirPath, item)
    const stat = fs.statSync(fullPath)
    
    if (stat.isDirectory()) {
      cleanDirectory(fullPath)
    } else if (stat.isFile()) {
      const ext = path.extname(fullPath).toLowerCase()
      if (['.json', '.js', '.ts', '.txt', '.log', '.env'].includes(ext)) {
        cleanSensitiveData(fullPath)
      }
    }
  })
}

function main() {
  console.log('🧹 开始清理敏感数据...')
  
  TARGET_PATHS.forEach(targetPath => {
    console.log(`\n📁 检查目录: ${targetPath}`)
    cleanDirectory(targetPath)
  })
  
  // 清理特定文件
  const specificFiles = [
    'package-lock.json',
    '.next/trace',
    '.next/server/trace'
  ]
  
  specificFiles.forEach(file => {
    if (fs.existsSync(file)) {
      cleanSensitiveData(file)
    }
  })
  
  console.log('\n✨ 敏感数据清理完成!')
  console.log('\n⚠️  请确保:')
  console.log('1. 将 .gitignore 添加到版本控制')
  console.log('2. 不要提交 data/ 目录到Git')
  console.log('3. 在生产环境中使用环境变量存储API密钥')
  console.log('4. 定期检查和清理敏感数据')
}

// 执行清理
main() 