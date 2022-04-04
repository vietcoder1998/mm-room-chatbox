import bdps from 'body-parser'
import express from 'express'
import { createServer } from 'http'
import path from 'path'
import { Server, Socket } from 'socket.io'
import { ChatResponse } from './data/response'
import { addMsg, readRoom } from './data/service'
import { Message } from './typing'

const app = express()

app.use(bdps.json())
app.get('/:name', async (req, res) => {
  const { name } = req.params
  res.sendFile(path.join(__dirname, name))
})

const server = createServer(app)

const io = new Server(server, {})
io.on('connection', (socket: Socket) => {
  try {
    socket.on('getRoom', async (room_id: string) => {
      const data = await readRoom(String(room_id))
      socket.emit('receiveRoom', new ChatResponse(data))
    })

    socket.on('addMsg', async (msg: Message, room_id: string) => {
      console.log(msg, room_id)
      const { msgs, result } = await addMsg(msg, room_id)
      socket.emit('receiveMsg', new ChatResponse({ msgs, result }), room_id)
    })
  } catch (error) {
    socket._error(error)
    throw error
  }
})

server.listen('3100', () => {
  console.log('server listen in port: 3100')
  console.log('http://localhost:3100')
})
