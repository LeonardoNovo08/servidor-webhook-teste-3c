require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const axios = require('axios');

// Inicializa o Express
const app = express();
app.use(express.json());

// Decodifica a chave da conta de serviço
function getGoogleCredentialsFromEnv() {
    const base64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
    if (!base64) {
        throw new Error('❌ GOOGLE_SERVICE_ACCOUNT_BASE64 não definido no .env');
    }
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
}

// Autenticação com Google Sheets
const auth = new google.auth.GoogleAuth({
    credentials: getGoogleCredentialsFromEnv(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Função para buscar o ID Kommo com base no nome do agente (coluna B)
async function buscarIDKommoPorAgent(agent) {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const spreadsheetId = '18AirEW1ayfKbHhRgpKSrIWQYvxfwY3AVKuyg8hAOrJw'; // Troque se necessário
    const range = 'Id User!A2:I';

    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values;

    for (const row of rows) {
        if (row[1] === agent) {
            return row[0]; // Retorna o ID Kommo
        }
    }

    return null;
}

// Middleware para tratar POST e PATCH
app.post('/webhook', handleWebhook);
app.patch('/webhook', handleWebhook);

async function handleWebhook(req, res) {
    console.log(`📩 Webhook recebido via ${req.method}`);
    console.log('🪵 Body recebido:', JSON.stringify(req.body, null, 2));
    console.log(JSON.stringify(req.body, null, 2));
    const entrada = Array.isArray(req.body) ? req.body[0] : req.body;
    const data = entrada?.['call-was-connected']?.call;

    if (!data) {
        console.warn('❌ Formato inválido: dados não encontrados');
        return res.status(400).send('Formato de webhook inválido');
    }

    const { agent, identifier: lead_id } = data;

    if (!agent || !lead_id) {
        return res.status(400).send('Campos "agent" ou "lead_id" ausentes');
    }

    try {
        const idKommo = await buscarIDKommoPorAgent(agent);
        if (!idKommo) {
            return res.status(404).send('ID Kommo não encontrado para o agente informado');
        }

        const url = `https://madm.kommo.com/api/v4/leads`;
        const payload = [{
            id: Number(lead_id),
            responsible_user_id: Number(idKommo)
        }];
        const headers = {
            'Authorization': `Bearer ${process.env.KOMMO_API_KEY}`,
            'Content-Type': 'application/json'
        };

        const response = await axios.patch(url, payload, { headers });

        if ([200, 204].includes(response.status)) {
            console.log('✅ Lead atualizado com sucesso!');
            return res.status(200).send('Lead atualizado com sucesso!');
        } else {
            console.error('❌ Erro ao atualizar lead:', response.status, response.data);
            return res.status(500).send('Erro ao atualizar o lead na Kommo');
        }

    } catch (err) {
        if (err.response) {
            console.error('❌ Erro de resposta da API Kommo:', err.response.data);
        } else {
            console.error('❌ Erro interno:', err.message);
        }
        return res.status(500).send('Erro interno no servidor');
    }
}

// Inicia o servidor
const PORT = process.env.PORT || 3000;
(async () => {
    try {
        const idTeste = await buscarIDKommoPorAgent('Leonardo Siqueira');
        console.log('🧪 ID encontrado para o agente:', idTeste);
    } catch (err) {
        console.error('❌ Erro no teste de busca de ID:', err.message);
    }
})();

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});