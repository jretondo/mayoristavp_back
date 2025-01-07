import path from 'path';

export const staticFolders = {
  certAfip: path.join(__dirname, '..', '..', 'public', 'afip', 'certs'),
  tokenAfip: path.join(__dirname, '..', '..', 'public', 'afip', 'token'),
  products: path.join(__dirname, '..', '..', 'public', 'images', 'products'),
  heroSlider: path.join(
    __dirname,
    '..',
    '..',
    'public',
    'images',
    'heroSlider',
  ),
};
