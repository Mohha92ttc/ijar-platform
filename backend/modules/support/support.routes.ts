import { Router } from 'express';
import { supportController } from './support.controller';
import { authenticateToken, requireRole } from '../auth/auth.middleware';

const router = Router();

// Public contact (Help page)
router.post('/contact', supportController.submitContact);

// Customer: my support tickets by account email
router.get(
  '/my-messages',
  authenticateToken,
  requireRole(['customer', 'owner', 'admin']),
  supportController.listMyMessages
);

// Admin inbox (persisted contact messages)
router.get(
  '/messages',
  authenticateToken,
  requireRole(['admin']),
  supportController.listMessages
);
router.patch(
  '/messages/:id',
  authenticateToken,
  requireRole(['admin']),
  supportController.updateMessage
);

// Support tickets
router.post('/tickets', authenticateToken, supportController.createTicket);
router.get('/tickets', authenticateToken, supportController.getTickets);
router.get('/tickets/:id', authenticateToken, supportController.getTicket);
router.put('/tickets/:id', authenticateToken, supportController.updateTicket);
router.delete('/tickets/:id', authenticateToken, requireRole(['admin']), supportController.deleteTicket);

// Live chat
router.post('/chat/start', authenticateToken, supportController.startChatSession);
router.post('/chat/:sessionId/message', authenticateToken, supportController.sendChatMessage);
router.get('/chat/:sessionId/messages', authenticateToken, supportController.getChatMessages);
router.post('/chat/:sessionId/end', authenticateToken, supportController.endChatSession);

// Knowledge base
router.get('/knowledge', authenticateToken, supportController.getKnowledgeBase);
router.get('/knowledge/search', authenticateToken, supportController.searchKnowledgeBase);

// Support analytics
router.get('/analytics', authenticateToken, requireRole(['admin']), supportController.getSupportAnalytics);

export default router;
