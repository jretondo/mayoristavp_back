export = {
  apps: [
    {
      name: 'P3016-mayoristavp-prod',
      script: 'dist/api/index.js',
      env: {
        PORT: 3016,
      },
    },
  ],
};
