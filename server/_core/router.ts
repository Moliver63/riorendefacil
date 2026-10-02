import { router } from "./trpc";
import { authRouter } from "./authRouter";
import { plataformaRouter, simuladorRouter } from "./plataformaRouter";
import { leadsRouter } from "./leadsRouter";
import { trilhaRouter } from "./trilhaRouter";
import { investidorRouter } from "./investidorRouter";
import { adminRouter } from "./adminRouter";

export const appRouter = router({
  auth: authRouter,
  plataforma: plataformaRouter,
  simulador: simuladorRouter,
  leads: leadsRouter,
  trilha: trilhaRouter,
  investidor: investidorRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
