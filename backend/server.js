import { fileURLToPath } from 'node:url';
import { createCollaborationServer } from './collaboration.js';

const { server } = createCollaborationServer({
  dataFile: fileURLToPath(new URL('./data/campus.json', import.meta.url)),
  secureCookie: process.env.NODE_ENV === 'production',
});
server.listen(Number(process.env.PORT || 3001), '0.0.0.0', () => console.log('Serveur Campus prêt sur le port ' + (process.env.PORT || 3001)));
