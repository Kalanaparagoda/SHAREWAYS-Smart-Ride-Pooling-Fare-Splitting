import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 15000,
})

// Global response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      toast.error('You are doing that too fast. Please wait a moment and try again.', {
        id: 'rate-limit', // deduplicate toasts
        duration: 5000,
      })
    }
    return Promise.reject(error)
  }
)

export default api
