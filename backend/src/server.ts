import dotenv from 'dotenv'
dotenv.config()

import app from './app'

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🚀 Server running on port ${PORT}         ║
║   📍 http://localhost:${PORT}                ║
║   📍 Health: /health                      ║
║   📍 Auth: /api/auth                      ║
║   📍 Employees: /api/employees            ║
╚═══════════════════════════════════════════╝
  `)
})