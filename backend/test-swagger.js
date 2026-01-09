#!/usr/bin/env node

// Quick test untuk verify Swagger setup
import { generateOpenApiDocument } from './src/config/openapi.js'

try {
  const doc = generateOpenApiDocument()
  console.log('✅ OpenAPI document generated successfully!')
  console.log(`📄 Total paths: ${Object.keys(doc.paths || {}).length}`)
  console.log(`📦 Total schemas: ${Object.keys(doc.components?.schemas || {}).length}`)
  console.log('\n🎯 Available endpoints:')
  Object.keys(doc.paths || {}).forEach(path => {
    console.log(`  - ${path}`)
  })
} catch (error) {
  console.error('❌ Error generating OpenAPI document:')
  console.error(error.message)
  process.exit(1)
}
