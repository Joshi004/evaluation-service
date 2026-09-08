import { useContext } from 'react'
import { PrototypeStoreContext, type PrototypeStoreValue } from './prototypeStoreContext'

export function usePrototypeStore(): PrototypeStoreValue {
  const context = useContext(PrototypeStoreContext)
  if (!context) {
    throw new Error('usePrototypeStore must be used within a PrototypeStoreProvider')
  }
  return context
}
