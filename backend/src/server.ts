import dotenv from 'dotenv'
dotenv.config()

import app from './app'

const PORT = process.env.PORT || 3000
const ENV = process.env.NODE_ENV || 'development'

app.listen(PORT, () => {
  console.log(`🚀 Server running in ${ENV} mode`)
  console.log(`📍 Local: http://localhost:${PORT}`)
  console.log(`📍 Health: http://localhost:${PORT}/health`)
  console.log(`📍 API: http://localhost:${PORT}/api/auth`)
})