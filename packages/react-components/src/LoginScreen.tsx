import { useState, useEffect, useCallback } from 'react'
import { User, Lock, LogIn, Loader2 } from 'lucide-react'
import { useAuth } from '@enlocal/react-hooks'

interface StaffMember {
  id: string
  name: string
  color: string
  role: string
}

interface LoginScreenProps {
  className?: string
  onLogin?: () => void
}

export function LoginScreen({ className, onLogin }: LoginScreenProps): JSX.Element {
  const { login, loading: authLoading } = useAuth()
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [loadingStaff, setLoadingStaff] = useState(true)
  const [selectedUser, setSelectedUser] = useState<StaffMember | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStaff = async () => {
      setLoadingStaff(true)
      try {
        const response = await fetch('/api/auth/staff-list')
        if (!response.ok) {
          throw new Error('Error al obtener la lista de personal')
        }
        const data = (await response.json()) as StaffMember[]
        setStaffList(data)
      } catch {
        setError('No se pudo cargar la lista de personal')
      } finally {
        setLoadingStaff(false)
      }
    }

    fetchStaff()
  }, [])

  const handleSelectUser = useCallback((staff: StaffMember) => {
    setSelectedUser(staff)
    setPin('')
    setError(null)
  }, [])

  const handlePinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
    setPin(value)
    setError(null)
  }, [])

  const handleLogin = useCallback(async () => {
    if (!selectedUser) {
      setError('Selecciona un usuario')
      return
    }

    if (pin.length < 4) {
      setError('El PIN debe tener al menos 4 digitos')
      return
    }

    setError(null)

    try {
      await login(pin, selectedUser.id)
      onLogin?.()
    } catch {
      setError('PIN incorrecto o error de autenticacion')
      setPin('')
    }
  }, [selectedUser, pin, login, onLogin])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && pin.length >= 4 && selectedUser) {
        handleLogin()
      }
    },
    [pin, selectedUser, handleLogin]
  )

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 ${className ?? ''}`}
    >
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Iniciar sesion</h1>
          <p className="mt-1 text-sm text-gray-500">Selecciona tu usuario e ingresa tu PIN</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {/* Staff list */}
          <div className="mb-6">
            <label className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
              <User className="h-4 w-4" />
              Usuario
            </label>

            {loadingStaff && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Cargando personal...</span>
              </div>
            )}

            {!loadingStaff && staffList.length === 0 && !error && (
              <p className="py-4 text-center text-sm text-gray-500">No se encontraron usuarios</p>
            )}

            {!loadingStaff && staffList.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {staffList.map((staff) => {
                  const isSelected = selectedUser?.id === staff.id
                  return (
                    <button
                      key={staff.id}
                      onClick={() => handleSelectUser(staff)}
                      className={`flex flex-col items-center rounded-lg border-2 p-3 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-sm'
                          : 'border-transparent bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
                      }`}
                      type="button"
                    >
                      <div
                        className="mb-2 flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{ backgroundColor: staff.color || '#6366f1' }}
                      >
                        {getInitials(staff.name)}
                      </div>
                      <span className="text-xs font-medium text-gray-700 truncate w-full text-center">
                        {staff.name}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* PIN input */}
          <div className="mb-6">
            <label
              htmlFor="pin-input"
              className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700"
            >
              <Lock className="h-4 w-4" />
              PIN
            </label>
            <input
              id="pin-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={handlePinChange}
              onKeyDown={handleKeyDown}
              placeholder="Ingresa tu PIN (4-6 digitos)"
              disabled={!selectedUser || authLoading}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-lg tracking-[0.5em] placeholder:tracking-normal placeholder:text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-100 disabled:text-gray-400"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Login button */}
          <button
            onClick={handleLogin}
            disabled={!selectedUser || pin.length < 4 || authLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500"
            type="button"
          >
            {authLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Ingresando...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Ingresar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
