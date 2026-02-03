export const environment = {
  production: true,
  apiKey: typeof process !== 'undefined' && process.env && process.env.API_KEY ? process.env.API_KEY : ''
};

