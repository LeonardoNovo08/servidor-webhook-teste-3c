//1. Importa o express
const express = require('express');

//2. cria uma aplicação express
const app = express();

//3. Permite receber JSON no body
app.use(express.json());

//4. Cria uma rota POST que escuta no caminho /webhook
app.post('/webhook', (req, res) => {
    console.log('webhook recebido!');
    console.log(req.body); // aqui ele imprime o que foi enviado para esse webhook
    res.status(200).send('Recebido com sucesso!');
});

//5. Inicia o servidor na porta 3000;
app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});



