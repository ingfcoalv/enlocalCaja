import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@enlocal/react-hooks'
import { LoginScreen } from '@enlocal/react-components'

export default function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
      return
    }

    // Check if server is ready (license is managed by launcher)
    fetch('/api/setup/state')
      .then(res => res.json())
      .then(data => {
        if (!data.licenseActivated) {
          // License not activated — launcher handles this
          setChecking(false)
        } else {
          setChecking(false)
        }
      })
      .catch(() => setChecking(false))
  }, [isAuthenticated, navigate])

  if (checking) return null

  const handleLogin = () => {
    navigate('/', { replace: true })
  }

  return <LoginScreen className="bg-primary-50" onLogin={handleLogin} />
}
