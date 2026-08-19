import { Router } from 'express';
import multer from 'multer';
import { makeTranscricaoController } from '../factories/MakeTranscricaoController';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // O Busboy sinaliza limite ao atingir o valor configurado. Um byte extra
    // permite aceitar exatamente 10 MiB e ainda rejeitar qualquer arquivo maior.
    fileSize: MAX_UPLOAD_BYTES + 1,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Apenas arquivos PDF são aceitos.'));
      return;
    }

    cb(null, true);
  },
});

const routes = Router();
const controller = makeTranscricaoController();

routes.post('/', upload.single('arquivo'), controller.iniciarUpload.bind(controller));
routes.put('/:id', controller.atualizarTranscricao.bind(controller));
routes.get('/:id/planilha', controller.baixarPlanilha.bind(controller));
routes.get('/:id', controller.consultarStatus.bind(controller));

export { routes as transcricaoRoutes };
