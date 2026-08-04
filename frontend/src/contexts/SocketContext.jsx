import { createContext, useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'

export const SocketContext = createContext(null)

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const [events, setEvents] = useState([])

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api'
    const socketInstance = io(baseUrl.replace(/\/api$/, ''), {
      transports: ['websocket'],
    })

    socketInstance.on('connect', () => {
      setSocket(socketInstance)
    })

    const pushEvent = (eventName, payload) => {
      setEvents((current) => [{ eventName, payload, timestamp: new Date().toISOString() }, ...current].slice(0, 10))
    }

    socketInstance.on('busLocationUpdated', (payload) => pushEvent('busLocationUpdated', payload))
    socketInstance.on('busDelayed', (payload) => pushEvent('busDelayed', payload))
    socketInstance.on('busCancelled', (payload) => pushEvent('busCancelled', payload))
    socketInstance.on('busStatusChanged', (payload) => pushEvent('busStatusChanged', payload))

    return () => {
      socketInstance.disconnect()
    }
  }, [])

  const value = useMemo(() => ({ socket, events }), [socket, events])

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}
