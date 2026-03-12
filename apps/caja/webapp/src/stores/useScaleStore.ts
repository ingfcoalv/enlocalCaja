import { create } from 'zustand'

interface ScaleState {
  weight: number
  unit: string
  stable: boolean
  connected: boolean
  setWeight: (weight: number, unit: string, stable: boolean) => void
  setConnected: (connected: boolean) => void
}

export const useScaleStore = create<ScaleState>((set) => ({
  weight: 0,
  unit: 'kg',
  stable: false,
  connected: false,

  setWeight: (weight, unit, stable) => {
    set({ weight, unit, stable })
  },

  setConnected: (connected) => {
    set({ connected })
  },
}))
