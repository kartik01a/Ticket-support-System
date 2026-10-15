import type { RequestHandler } from 'express';
import type { TicketService } from '../services/ticket.service';
import type { CreateTicketBody, ListTicketsQuery } from '../validation/ticket.schemas';

export function createTicketController(service: TicketService) {
  const create: RequestHandler = async (req, res) => {
    const ticket = await service.createTicket(req.body as CreateTicketBody);
    res.status(201).json({ data: ticket });
  };

  const list: RequestHandler = (_req, res) => {
    res.json(service.listTickets(res.locals.query as ListTicketsQuery));
  };

  const remove: RequestHandler = (_req, res) => {
    service.deleteTicket((res.locals.params as { id: string }).id);
    res.status(204).send();
  };

  return { create, list, remove };
}
