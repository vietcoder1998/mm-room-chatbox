import bdps from 'body-parser'
import express from 'express'
import { createServer } from 'http'
import path from 'path'
import { Server, Socket } from 'socket.io'
import { ChatResponse } from './data/response'
import { readRoom } from './data/service'

const app = express()

app.use(bdps.json())
app.get('/:name', async (req, res) => {
  const { name } = req.params
  res.sendFile(path.join(__dirname, name))
})

// app.get('/:name.html', async (req, res) => {
//   const { name } = req.params
//   writeContext(name).then(() => {
//     res.sendFile(path.join(__dirname, 'export', `${name}.html`))
//   })
// })

const server = createServer(app)

const io = new Server(server, {})
io.on('connection', (socket: Socket) => {
  socket.on('getRoom', async (room_id: string) => {
    const data = await readRoom(String(room_id))
    socket.emit('receiveRoom', new ChatResponse(data))
  })
})

server.listen('3100', () => {
  console.log('server listen in port: 3100')
  console.log('http://localhost:3100')
})
