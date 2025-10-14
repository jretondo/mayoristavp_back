import { sendErrorEmail } from '../utils/sendEmails/sendError';
import { error } from './response';
import { ErrorRequestHandler } from 'express';

export const errorTrhow: ErrorRequestHandler = (err, req, res, next) => {
  console.error('[error]', err);
  const message = err.message || 'Unexpected Error';
  const status = 500;
  sendErrorEmail(
    err,
    req.url,
    '',
    ['jretondo90@gmail.com', 'Madonnamariana264@gmail.com'],
    'Error en API MayoristaVP',
  );
  error({
    req: req,
    res: res,
    status: status,
    message: message,
  });
};
