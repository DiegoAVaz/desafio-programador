import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { transcricaoRoutes } from './routes/transcricao.routes';

const app = express();

app.use(cors());
app.use(express.json());

// Rota de healthcheck exigida pelo desafio[cite: 2]
app.get('/healthz', (req, res) => res.status(200).send('OK'));

// Rotas da API
app.use('/api/transcricoes', transcricaoRoutes);

app.use((erro: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (erro instanceof multer.MulterError && erro.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ erro: 'O arquivo deve ter no máximo 10 MB.' });
    return;
  }
  if (erro instanceof Error && erro.message === 'Apenas arquivos PDF são aceitos.') {
    res.status(400).json({ erro: erro.message });
    return;
  }
  res.status(500).json({ erro: 'Ocorreu um erro inesperado ao processar a requisição.' });
});

export { app };
