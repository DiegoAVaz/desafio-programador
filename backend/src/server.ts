import { app } from './app';

const PORTA = process.env.PORT || 3000;

app.listen(PORTA, () => {
  console.log(`🚀 Backend rodando na porta ${PORTA} com TypeScript!`);
});