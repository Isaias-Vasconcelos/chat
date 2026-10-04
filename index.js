const express = require('express');
const app = express();

const { createServer } = require('node:http');
const { join } = require('node:path');

const { Server } = require('socket.io');

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const server = createServer(app);
const io = new Server(server);

async function start() {

    // Abre o banco
    const db = await open({
        filename: 'chat.db',
        driver: sqlite3.Database
    });

    // Cria a tabela
    await db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guid TEXT,
            content TEXT
        );
    `);

    // Página inicial
    app.get('/', (req, res) => {
        res.sendFile(join(__dirname, 'index.html'));
    });

    app.get('/messages', async (req, res) => {
        try {
            const messages = await db.all('SELECT * FROM messages ORDER BY id ASC');
            res.json(messages);
        } catch (error) {
            console.error('Erro ao buscar mensagens:', error);
            res.status(500).json({ error: 'Erro ao buscar mensagens' });
        }
    });

    // Socket.IO
    io.on('connection', (socket) => {

        console.log('Usuário conectado:', socket.id);

        // Informa aos outros clientes
        io.emit('user-connected', {
            id: socket.id
        });

        // Recebe mensagem
        socket.on('send-message', async (msg) => {

            console.log('Mensagem recebida:', msg);

            try {

                await db.run(
                    `
                    INSERT INTO messages (guid, content)
                    VALUES (?, ?)
                    `,
                    [msg.guid, msg.content]
                );

                // Envia para todos
                io.emit('message-received', msg);

            } catch (error) {

                console.error('Erro ao salvar mensagem:', error);

            }
        });

        // Desconectou
        socket.on('disconnect', () => {

            console.log('Usuário desconectado:', socket.id);

            io.emit('user-disconnected', {
                id: socket.id
            });

        });

    });

    // Inicia servidor
    server.listen(3000, () => {
        console.log('Servidor rodando em http://localhost:3000');
    });
}

start();