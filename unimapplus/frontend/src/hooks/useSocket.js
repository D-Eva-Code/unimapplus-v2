import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      transports: ['polling', 'websocket'],
      autoConnect: true,
    });
  }
  return socketInstance;
}

export function useSocket() {
  const socketRef = useRef(getSocket());
  return socketRef.current;
}

// Tracks one or more orders. Pass an array of order IDs.
export function useOrderTracking(orderIds, onStatusUpdate, onRiderLocation) {
  const socket = useSocket();
  const ids = Array.isArray(orderIds)
    ? orderIds.filter(Boolean)
    : orderIds ? [orderIds] : [];

  useEffect(() => {
    if (ids.length === 0) return;

    // Join a room for every active order
    ids.forEach((id) => socket.emit('join_order', id));

    const handleStatus = (data) => {
      if (ids.includes(data.order_id)) onStatusUpdate?.(data);
    };

    const handleLocation = (data) => {
      if (ids.includes(data.order_id)) onRiderLocation?.(data);
    };

    socket.on('order_status_updated', handleStatus);
    socket.on('rider_location', handleLocation);

    return () => {
      socket.off('order_status_updated', handleStatus);
      socket.off('rider_location', handleLocation);
    };
  }, [ids.join(',')]);
}
