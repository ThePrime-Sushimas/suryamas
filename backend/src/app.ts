import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import authRoutes from './routes/auth'

const app = express()

app.use(helmet())
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)

export default app