require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Inicializa o Express
const app = express();
app.use(express.json());

// Autenticação com Google Sheets (conta de serviço)
const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'lithe-transport-456818-g5-faf4764df975.json'), // substitua pelo nome do seu arquivo
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Função para buscar o ID Kommo com base no nome do agente (coluna B)
async function buscarIDKommoPorAgent(agent) {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const spreadsheetId = '18AirEW1ayfKbHhRgpKSrIWQYvxfwY3AVKuyg8hAOrJw';
    const range = 'Id User!A2:I'; // O intervalo que inclui a coluna B (Agente) e A (ID Kommo)

    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values;

    for (const row of rows) {
        console.log('Comparando:', row[1], 'vs', agent); // Compara na coluna B (Agente)

        if (row[1] === agent) { // Coluna B para buscar o nome do agente
            console.log('Match encontrado!');
            return row[0]; // Coluna A para retornar o ID Kommo
        }
    }

    return null;
}

// Rota POST e PATCH do Webhook
app.post('/webhook', handleWebhook);
app.patch('/webhook', handleWebhook);

async function handleWebhook(req, res) {
    console.log(`Webhook recebido via ${req.method}`);
    console.log('Corpo da requisição:', JSON.stringify(req.body, null, 2));

    if (!Array.isArray(req.body) || req.body.length === 0) {
        return res.status(400).send('Payload de webhook inválido');
    }

    const data = req.body[0]?.['call-was-connected']?.call;
    if (!data) {
        return res.status(400).send('Formato de webhook inválido');
    }

    const agent = data.agent;
    const lead_id = data.identifier;

    if (!agent || !lead_id) {
        return res.status(400).send('Campo agent ou lead_id não fornecido');
    }

    try {
        const idKommo = await buscarIDKommoPorAgent(agent);
        if (!idKommo) {
            return res.status(404).send('ID Kommo não encontrado para o agente informado');
        }

        const url = `https://madm.kommo.com/api/v4/leads/${lead_id}`;
        const payload = [
        {
            id: Number(lead_id), // transformando lead_id em número 
            responsible_user_id: Number(idKommo)
        }
    ];
        const headers = {
            'Authorization': `Bearer ${process.env.KOMMO_API_KEY}`,
            'Content-Type': 'application/json'
        };
       
        console.log('Payload que será enviado para Kommo:', payload);
        console.log('URL para onde será enviado:', url);

        const response = await axios.patch(url, payload, { headers });
        console.log('Resposta do Kommo:', response.data);

        if ([200, 204].includes(response.status)) {
            return res.status(200).send('Lead atualizado com sucesso!');
        } else {
            return res.status(500).send('Erro ao atualizar o lead na Kommo');
        }

    } catch (err) {
        console.error('Erro ao processar webhook:', err.response?.data || err.message);
        return res.status(500).send('Erro interno no servidor');
    }
}

// Inicia o servidor
app.listen(3000, () => {
    console.log('🚀 Servidor rodando na porta 3000');
});
