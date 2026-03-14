import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      transports: ['websocket'],
      autoConnect: true,
    });
  }
  return socketInstance;
}

export function useSocket() {
  const socketRef = useRef(getSocket());
  return socketRef.current;
}

export function useOrderTracking(orderId, onStatusUpdate, onRiderLocation) {
  const socket = useSocket();

  useEffect(() => {
    if (!orderId) return;
    socket.emit('join_order', orderId);

    socket.on('order_status_updated', (data) => {
      if (data.order_id === orderId) onStatusUpdate?.(data);
    });

    socket.on('rider_location', (data) => {
      if (data.order_id === orderId) onRiderLocation?.(data);
    });

    return () => {
      socket.off('order_status_updated');
      socket.off('rider_location');
    };
  }, [orderId]);
}
