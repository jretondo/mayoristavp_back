import path from 'path';
import ejs from 'ejs';
import sendEmail from './sendmail';

export const sendErrorEmail = async (
  error: Error,
  endpoint: string,
  extraInfo: string,
  email: string[],
  subject: string,
): Promise<any> => {
  const datos = {
    clientName: 'Mariana',
    timestamp: new Date().toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
    }),
    errorMessage: error.message,
    stackTrace: error.stack,
    endpoint,
    extraInfo,
  };
  console.log(datos);
  if (error.message.includes(`reading 'pv'`)) {
    return;
  }
  return new Promise((resolve, reject) => {
    ejs.renderFile(
      path.join('views', 'emails', 'Templates', 'ErrorEmail.ejs'),
      datos,
      async (err, data) => {
        if (err) {
          console.error(err);
          resolve(false);
        } else {
          try {
            resolve(email.map((addr) => sendEmail(addr, subject, data)));
          } catch (error) {
            console.error(error);
            reject(error);
          }
        }
      },
    );
  });
};
