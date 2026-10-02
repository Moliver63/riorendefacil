import { router } from "./_core/trpc";
import { authRouter } from "./routers/auth";
import { plataformaRouter, simuladorRouter } from "./routers/plataforma";
import { leadsRouter } from "./routers/leads";
import { trilhaRouter } from "./routers/trilha";
import { investidorRouter } from "./routers/investidor";
import { adminRouter } from "./routers/admin";

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
