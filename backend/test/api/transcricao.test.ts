import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/pdfProcessor', () => ({
  processarArquivo: vi.fn(async () => ({ pages: [] })),
}));

import { app } from '../../src/app';

describe('API de transcrições', () => {
  it('responde ao healthcheck', async () => {
    const response = await request(app).get('/healthz');
    expect(response.status).toBe(200);
    expect(response.text).toBe('OK');
  });

  it('valida arquivo e tipo obrigatórios', async () => {
    const [noFile, invalidType, invalidMime] = await Promise.all([
      request(app).post('/api/transcricoes').field('tipo', 'holerite'),
      request(app).post('/api/transcricoes').field('tipo', 'invalido').attach('arquivo', Buffer.from('%PDF'), { filename: 'documento.pdf', contentType: 'application/pdf' }),
      request(app).post('/api/transcricoes').field('tipo', 'holerite').attach('arquivo', Buffer.from('texto'), { filename: 'documento.txt', contentType: 'text/plain' }),
    ]);

    expect(noFile).toMatchObject({ status: 400, body: { erro: expect.any(String) } });
    expect(invalidType).toMatchObject({ status: 400, body: { erro: expect.any(String) } });
    expect(invalidMime).toMatchObject({ status: 400, body: { erro: 'Apenas arquivos PDF são aceitos.' } });
  });

  it('aceita exatamente 10 MiB e rejeita qualquer byte acima', async () => {
    const limit = 10 * 1024 * 1024;
    const exact = await request(app)
      .post('/api/transcricoes')
      .field('tipo', 'holerite')
      .attach('arquivo', Buffer.alloc(limit), { filename: 'limite.pdf', contentType: 'application/pdf' });
    const above = await request(app)
      .post('/api/transcricoes')
      .field('tipo', 'holerite')
      .attach('arquivo', Buffer.alloc(limit + 1), { filename: 'acima.pdf', contentType: 'application/pdf' });

    expect(exact.status).toBe(202);
    expect(exact.body).toEqual({ id: expect.any(String) });
    expect(above).toMatchObject({ status: 413, body: { erro: expect.any(String) } });
  });

  it('retorna 404 para uma transcrição inexistente', async () => {
    const response = await request(app).get('/api/transcricoes/nao-existe');
    expect(response).toMatchObject({ status: 404, body: { erro: expect.any(String) } });
  });
});
