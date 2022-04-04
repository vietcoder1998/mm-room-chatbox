import fs from 'fs'
import path from 'path'
import { resolve } from 'path/posix'
import { Message } from '../typing'

const dir = (id: string) => {
  return {
    msgs: path.join(__dirname, 'rooms', id, 'msgs.json'),
    user: path.join(__dirname, 'rooms', id, 'user.json')
  }
}

export async function readRoom(id: string) {
  const linked: any = dir(id)
  const msgs = JSON.parse(await fs.readFileSync(linked.msgs).toString())
  const user = JSON.parse(await fs.readFileSync(linked.user).toString())
  return {
    msgs,
    user
  }
}

export async function addMsg(msg: Message, room_id: string, next: Function) {
  const linked: any = dir(room_id)
  fs.readFile(
    linked.msg,
    { encoding: 'utf8' },
    async (err: any, data: string) => {
      const msgs: Message[] = JSON.parse(data.toString())
      fs.writeFile(linked.msgs, JSON.stringify(msgs), (err: any) => {
        next(msgs)
      })
    }
  )
}
