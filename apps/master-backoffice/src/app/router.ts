import { createBrowserRouter } from 'react-router-dom';
import { routes } from './routes';

// import.meta.env.BASE_URL mirrors vite.config.ts's base ("/" locally, e.g.
// "/backoffice/super/" in production) - see the comment there for why this
// stays in sync automatically instead of needing its own env var.
export const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL });
