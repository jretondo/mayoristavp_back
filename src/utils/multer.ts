import { Request } from 'express';
import multer from 'multer';
import path from 'path';

const uploadFile = (folderDest: string, fields?: Array<string>) => {
  const storage = multer.diskStorage({
    destination: folderDest,
    filename: (req: Request, file: any, cb: any) => {
      if (!req.body.filesName) {
        req.body.filesName = [];
      }
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);

      const extention = path.extname(file.originalname);

      req.body.filesName.push({
        fieldName: file.fieldname,
        path: path.join(`${uniqueSuffix}${extention}`),
      });
      cb(null, `${uniqueSuffix}${extention}`);
    },
  });
  let upload;

  if (fields) {
    const arrayFields: Array<any> = fields.map((item) => {
      return { name: item };
    });
    upload = multer({
      storage,
    }).fields(arrayFields);
  } else {
    upload = multer({
      storage,
    }).any();
  }

  return upload;
};

export = uploadFile;
