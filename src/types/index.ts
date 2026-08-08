// Shared domain types for BarberFlow

export interface Barber {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'away';
  average_service_time?: number;
}

export interface Ticket {
  id: string;
  customer_name: string;
  preferred_barbers: string[];
  status: 'waiting' | 'serving' | 'done' | 'cancelled';
  created_at: number;
  assigned_barber?: string;
  started_at?: number;
}

// Alias kept for components that used QueueItem name
export type QueueItem = Ticket;
