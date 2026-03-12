import { useState, useCallback } from 'react'
import { api } from './useAuth'

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

interface CRUDResult<T> {
  items: T[]
  loading: boolean
  error: string | null
  pagination: Pagination
  fetchAll: (filters?: Record<string, unknown>) => Promise<void>
  getById: (id: string) => Promise<T>
  create: (data: Partial<T>) => Promise<T>
  update: (id: string, data: Partial<T>) => Promise<T>
  remove: (id: string) => Promise<void>
}

export function useCRUD<T = Record<string, unknown>>(basePath: string): CRUDResult<T> {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  })

  const fetchAll = useCallback(async (filters?: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get(basePath, { params: filters })

      // Support both { data: [...], pagination: {...} } and plain array responses
      if (Array.isArray(data)) {
        setItems(data)
        setPagination({
          page: 1,
          limit: data.length,
          total: data.length,
          pages: 1,
        })
      } else {
        setItems(data.data || data.items || [])
        if (data.pagination) {
          setPagination({
            page: data.pagination.page ?? 1,
            limit: data.pagination.limit ?? 20,
            total: data.pagination.total ?? 0,
            pages: data.pagination.pages ?? 0,
          })
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching data'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [basePath])

  const getById = useCallback(async (id: string): Promise<T> => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get(`${basePath}/${id}`)
      return data.data || data
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching record'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [basePath])

  const create = useCallback(async (payload: Partial<T>): Promise<T> => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.post(basePath, payload)
      const created: T = data.data || data
      setItems((prev) => [...prev, created])
      setPagination((prev) => ({ ...prev, total: prev.total + 1 }))
      return created
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error creating record'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [basePath])

  const update = useCallback(async (id: string, payload: Partial<T>): Promise<T> => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.put(`${basePath}/${id}`, payload)
      const updated: T = data.data || data
      setItems((prev) =>
        prev.map((item) => {
          const record = item as Record<string, unknown>
          if (record.id === id || record._id === id) {
            return updated
          }
          return item
        })
      )
      return updated
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error updating record'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [basePath])

  const remove = useCallback(async (id: string): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      await api.delete(`${basePath}/${id}`)
      setItems((prev) =>
        prev.filter((item) => {
          const record = item as Record<string, unknown>
          return record.id !== id && record._id !== id
        })
      )
      setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error deleting record'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [basePath])

  return {
    items,
    loading,
    error,
    pagination,
    fetchAll,
    getById,
    create,
    update,
    remove,
  }
}
