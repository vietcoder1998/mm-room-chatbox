export interface Message {
  id: number
  content: string
  date: number
  room_id: number
  owner_id: number
}

export interface User {
  id: number
  name: string
  gender: 'male' | 'female'
}

export interface Room {
  id: number
  users: User[]
}
