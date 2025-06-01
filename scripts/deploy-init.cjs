#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

console.log('🚀 部署初始化脚本开始...')

// 1. 清理数据目录
function cleanDataDirectory() {
  console.log('🧹 清理数据目录...')
  
  const dataDir = path.join(process.cwd(), 'data')
  
  if (fs.existsSync(dataDir)) {
    try {
      // 删除所有数据文件
      const files = fs.readdirSync(dataDir)
      files.forEach(file => {
        const filePath = path.join(dataDir, file)
        fs.unlinkSync(filePath)
        console.log(`✅ 删除数据文件: ${file}`)
      })
      
      // 删除数据目录
      fs.rmdirSync(dataDir)
      console.log('✅ 数据目录已清理')
    } catch (error) {
      console.log(`⚠️  清理数据目录时出现问题: ${error.message}`)
    }
  } else {
    console.log('ℹ️  数据目录不存在')
  }
}

// 2. 设置生产环境配置
function setupProductionConfig() {
  console.log('⚙️  设置生产环境配置...')
  
  // 创建或更新 .env.production
  const envContent = `
# 生产环境配置
NODE_ENV=production
DISABLE_FILE_STORAGE=true
MAX_STORAGE_ITEMS=1000
DATA_EXPIRY_DAYS=1

# 安全设置
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_DEMO_MODE=true
`.trim()

  fs.writeFileSync('.env.production', envContent)
  console.log('✅ 生产环境配置已设置')
}

// 3. 创建安全的 robots.txt
function createRobotsTxt() {
  console.log('🤖 创建 robots.txt...')
  
  const robotsContent = `
User-agent: *
Disallow: /api/
Disallow: /data/
Disallow: /_next/
Disallow: /scripts/

# 允许访问主页
Allow: /

Sitemap: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/sitemap.xml
`.trim()

  fs.writeFileSync(path.join('public', 'robots.txt'), robotsContent)
  console.log('✅ robots.txt 已创建')
}

// 4. 验证安全配置
function validateSecurity() {
  console.log('🔒 验证安全配置...')
  
  const securityChecks = [
    {
      name: '检查 .gitignore',
      check: () => {
        const gitignoreContent = fs.readFileSync('.gitignore', 'utf8')
        return gitignoreContent.includes('/data/') && gitignoreContent.includes('.env')
      }
    },
    {
      name: '检查数据目录',
      check: () => !fs.existsSync('data/')
    },
    {
      name: '检查环境变量',
      check: () => fs.existsSync('.env.production')
    }
  ]
  
  securityChecks.forEach(({ name, check }) => {
    if (check()) {
      console.log(`✅ ${name}: 通过`)
    } else {
      console.log(`❌ ${name}: 失败`)
    }
  })
}

// 5. 显示部署说明
function showDeploymentInstructions() {
  console.log('\n📋 部署说明:')
  console.log('1. 确保在生产环境中设置了正确的环境变量')
  console.log('2. 数据将存储在内存中，重启后会丢失')
  console.log('3. 不要在生产环境中存储真实的API密钥')
  console.log('4. 定期检查和清理敏感数据')
  console.log('5. 监控内存使用情况')
  
  console.log('\n🔐 安全提醒:')
  console.log('- 所有用户数据将在会话结束后删除')
  console.log('- API密钥仅存储在用户浏览器本地')
  console.log('- 服务器不会持久化任何敏感信息')
  console.log('- 建议定期重启应用以清理内存')
}

function main() {
  try {
    cleanDataDirectory()
    setupProductionConfig()
    createRobotsTxt()
    validateSecurity()
    showDeploymentInstructions()
    
    console.log('\n✨ 部署初始化完成!')
  } catch (error) {
    console.error('❌ 部署初始化失败:', error.message)
    process.exit(1)
  }
}

// 执行初始化
main() 