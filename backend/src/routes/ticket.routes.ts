import { Router, type RequestHandler } from 'express';
import { createTicketController } from '../controllers/ticket.controller';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import type { TicketService } from '../services/ticket.service';
import { createTicketBody, listTicketsQuery, ticketIdParams } from '../validation/ticket.schemas';

export function createTicketRouter(service: TicketService, createLimiter?: RequestHandler): Router {
  const router = Router();
  const controller = createTicketController(service);

  router.get('/', validateQuery(listTicketsQuery), controller.list);
  router.post('/', ...(createLimiter ? [createLimiter] : []), validateBody(createTicketBody), controller.create);

  router.delete('/:id', validateParams(ticketIdParams), controller.remove);

  return router;
}
