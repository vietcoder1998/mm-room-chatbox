import fs from 'fs'
import path from 'path'
import { resolve } from 'path/posix'
import { Message } from '../typing'

export async function readRoom(id: string) {
  const dir = path.join(__dirname, 'rooms', id)
  const msgs = JSON.parse(
    await fs.readFileSync(path.join(dir, 'msg.json')).toString()
  )
  const user = JSON.parse(
    await fs.readFileSync(path.join(dir, 'user.json')).toString()
  )
  return {
    msgs,
    user
  }
}

export async function addMsg(msg: Message, room_id: string) {
  return await fs.writeFileSync(
    path.join(__dirname, 'rooms', room_id, `${msg.id}.json`),
    JSON.stringify(msg)
  )
}
