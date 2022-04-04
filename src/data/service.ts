import fs from 'fs'
import path from 'path'
import { resolve } from 'path/posix'
import { Message } from '../typing'

const dir = (id: string) => {
  return {
    msg: path.join(__dirname, 'rooms', id, 'msg.json'),
    user: path.join(__dirname, 'rooms', id, 'user.json')
  }
}

export async function readRoom(id: string) {
  const linked: any = dir(id)
  const msgs = JSON.parse(await fs.readFileSync(linked.msg).toString())
  const user = JSON.parse(await fs.readFileSync(linked.user).toString())
  return {
    msgs,
    user
  }
}

export async function addMsg(msg: Message, room_id: string) {
  const linked: any = dir(room_id)
  fs.readFile(
    linked.msg,
    { encoding: 'utf8' },
    async (err: any, data: string) => {
      console.log(dir(room_id))
      console.log(data)
      const msgs = JSON.parse(data.toString())
      msgs.push(msg)

      const result = await fs.writeFileSync(linked.msg, JSON.stringify(msgs))
      console.log(result, msgs)
    }
  )

  return {
    result: false,
    msgs: []
  }
}
