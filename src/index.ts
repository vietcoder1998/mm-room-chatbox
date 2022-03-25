import express from 'express'
import {
    write_context
} from './convert'
import path from 'path'
const app = express()

app.get('/:name', async (req, res) => {
    const { name } = req.params
    write_context(name).then(() => {
        res.sendFile(path.join(__dirname,'export', `${name}.html`))
    })
})


app.listen('3100', () => {
    console.log('server listen in port: 3100')
    console.log('http://localhost:3100')
})