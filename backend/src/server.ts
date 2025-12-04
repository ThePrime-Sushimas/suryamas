import dotenv from 'dotenv'
import app from './app'

dotenv.config()

app.listen(3001, () => {
  console.log('Server running on http://localhost:3001')
})