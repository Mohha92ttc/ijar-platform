import { query } from '../../database/connection';
import { NotificationService } from '../../services/notification.service';

export interface SupportTicket {
  id: string;
  userId: string;
  category: 'technical' | 'billing' | 'equipment' | 'account' | 'general';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  subject: string;
  description: string;
  attachments: string[];
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolution?: string;
  rating?: number;
  feedback?: string;
}

export interface SupportAgent {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: 'technical' | 'billing' | 'customer_service';
  isOnline: boolean;
  maxConcurrentChats: number;
  currentChats: number;
  languages: string[];
  rating: number;
  totalTickets: number;
  averageResponseTime: number;
}

export interface LiveChatSession {
  id: string;
  userId: string;
  agentId?: string;
  status: 'waiting' | 'active' | 'ended';
  startedAt: Date;
  endedAt?: Date;
  messages: ChatMessage[];
  rating?: number;
  feedback?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  senderId: string;
  senderType: 'user' | 'agent';
  content: string;
  type: 'text' | 'image' | 'file';
  timestamp: Date;
  isRead: boolean;
}

export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  language: string;
  views: number;
  helpful: number;
  notHelpful: number;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
}

export class SupportService {
  private notificationService: NotificationService;
  private activeChats: Map<string, LiveChatSession> = new Map();
  private availableAgents: Map<string, SupportAgent> = new Map();

  constructor() {
    this.notificationService = new NotificationService();
    this.initializeAgents();
  }

  async createTicket(ticketData: Partial<SupportTicket>): Promise<SupportTicket> {
    const sql = `
      INSERT INTO support_tickets (
        user_id, category, priority, subject, description, 
        attachments, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await query(sql, [
      ticketData.userId,
      ticketData.category,
      ticketData.priority,
      ticketData.subject,
      ticketData.description,
      JSON.stringify(ticketData.attachments || []),
      'open',
      new Date(),
      new Date()
    ]);

    const ticket = this.mapRowToTicket(result.rows[0]);

    // إرسال إشعار بإنشاء التذكرة
    if (ticketData.userId) {
      await this.notificationService.sendNotification({
        userId: ticketData.userId,
        type: 'system',
        title: 'تم إنشاء تذكرة دعم فني',
        message: `تم إنشاء تذكرتك #${ticket.id} بنجاح. سيتم الرد خلال 24 ساعة`,
        data: { ticketId: ticket.id }
      });
    }

    // إشعار للفريق
    await this.notifySupportTeam(ticket);

    return ticket;
  }

  async updateTicketStatus(ticketId: string, status: string, assignedTo?: string, resolution?: string): Promise<SupportTicket> {
    const sql = `
      UPDATE support_tickets 
      SET status = $1, assigned_to = $2, resolution = $3, updated_at = $4,
          resolved_at = CASE WHEN $1 = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END
      WHERE id = $5
      RETURNING *
    `;

    const result = await query(sql, [status, assignedTo, resolution, new Date(), ticketId]);
    const ticket = this.mapRowToTicket(result.rows[0]);

    // إرسال إشعار بتحديث التذكرة
    await this.notificationService.sendNotification({
      userId: ticket.userId,
      type: 'system',
      title: 'تحديث تذكرة الدعم',
      message: `تم تحديث تذكرتك #${ticketId} إلى: ${this.getStatusText(status)}`,
      data: { ticketId, status }
    });

    return ticket;
  }

  async startLiveChat(userId: string): Promise<LiveChatSession> {
    const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: LiveChatSession = {
      id: sessionId,
      userId,
      status: 'waiting',
      startedAt: new Date(),
      messages: []
    };

    // حفظ الجلسة في قاعدة البيانات
    await this.saveChatSession(session);

    // محاولة تعيين وكيل فوري
    const agent = await this.assignAgent(sessionId);
    if (agent) {
      session.agentId = agent.id;
      session.status = 'active';
      await this.updateChatSession(session);
    }

    this.activeChats.set(sessionId, session);

    return session;
  }

  async sendMessage(sessionId: string, senderId: string, senderType: 'user' | 'agent', content: string, type: 'text' | 'image' | 'file' = 'text'): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      senderId,
      senderType,
      content,
      type,
      timestamp: new Date(),
      isRead: false
    };

    // حفظ الرسالة
    await this.saveChatMessage(message);

    // تحديث الجلسة
    const session = this.activeChats.get(sessionId);
    if (session) {
      session.messages.push(message);
      await this.updateChatSession(session);
    }

    // إرسال إشعار للمستلم
    if (senderType === 'agent') {
      await this.notificationService.sendNotification({
        userId: session?.userId,
        type: 'message',
        title: 'رسالة جديدة من الدعم الفني',
        message: content.length > 100 ? content.substring(0, 100) + '...' : content,
        data: { sessionId, messageId: message.id }
      });
    }

    return message;
  }

  async endChatSession(sessionId: string, rating?: number, feedback?: string): Promise<void> {
    const session = this.activeChats.get(sessionId);
    if (!session) return;

    session.status = 'ended';
    session.endedAt = new Date();
    session.rating = rating;
    session.feedback = feedback;

    await this.updateChatSession(session);

    // تحرير الوكيل
    if (session.agentId) {
      const agent = this.availableAgents.get(session.agentId);
      if (agent) {
        agent.currentChats--;
        this.availableAgents.set(session.agentId, agent);
      }
    }

    this.activeChats.delete(sessionId);

    // إرسال إشعار تقييم
    if (rating) {
      await this.notificationService.sendNotification({
        userId: session.userId,
        type: 'system',
        title: 'شكراً لتقييمك',
        message: 'نقدر تقييمك لخدمة الدعم الفني',
        data: { sessionId, rating }
      });
    }
  }

  async getKnowledgeBaseArticles(category?: string, language: string = 'ar'): Promise<KnowledgeBaseArticle[]> {
    let sql = `
      SELECT * FROM knowledge_base 
      WHERE language = $1
    `;
    const params = [language];

    if (category) {
      sql += ' AND category = $2';
      params.push(category);
    }

    sql += ' ORDER BY views DESC, helpful DESC LIMIT 50';

    const result = await query(sql, params);
    return result.rows.map(row => this.mapRowToArticle(row));
  }

  async searchKnowledgeBase(searchQuery: string, language: string = 'ar'): Promise<KnowledgeBaseArticle[]> {
    const sql = `
      SELECT * FROM knowledge_base 
      WHERE language = $1 
      AND (title ILIKE $2 OR content ILIKE $2 OR tags && $3)
      ORDER BY views DESC, helpful DESC
      LIMIT 20
    `;

    const result = await query(sql, [language, `%${searchQuery}%`, searchQuery.split(' ')]);
    return result.rows.map(row => this.mapRowToArticle(row));
  }

  async rateArticle(articleId: string, helpful: boolean): Promise<void> {
    const field = helpful ? 'helpful' : 'not_helpful';
    await query(
      `UPDATE knowledge_base SET ${field} = ${field} + 1 WHERE id = $1`,
      [articleId]
    );
  }

  async getAgentStats(agentId: string): Promise<any> {
    const sql = `
      SELECT 
        COUNT(*) as total_tickets,
        AVG(CASE WHEN status = 'resolved' THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 END) as avg_resolution_hours,
        AVG(rating) as avg_rating,
        COUNT(CASE WHEN rating >= 4 THEN 1 END) as positive_ratings
      FROM support_tickets 
      WHERE assigned_to = $1 AND status = 'resolved'
    `;

    const result = await query(sql, [agentId]);
    return result.rows[0];
  }

  async getSupportMetrics(): Promise<any> {
    const sql = `
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tickets,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets,
        AVG(CASE WHEN status = 'resolved' THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 END) as avg_resolution_hours,
        AVG(rating) as avg_rating
      FROM support_tickets 
      WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
    `;

    const result = await query(sql);
    return result.rows[0];
  }

  private async initializeAgents(): Promise<void> {
    // تهيئة الوكلاء افتراضياً
    const agents: SupportAgent[] = [
      {
        id: 'agent_1',
        name: 'أحمد محمد',
        email: 'ahmed@ijar.iq',
        phone: '+964 7700 123 456',
        department: 'technical',
        isOnline: true,
        maxConcurrentChats: 5,
        currentChats: 0,
        languages: ['ar', 'en'],
        rating: 4.8,
        totalTickets: 1250,
        averageResponseTime: 180 // 3 دقائق
      },
      {
        id: 'agent_2',
        name: 'فاطمة علي',
        email: 'fatima@ijar.iq',
        phone: '+964 7500 789 012',
        department: 'customer_service',
        isOnline: true,
        maxConcurrentChats: 8,
        currentChats: 0,
        languages: ['ar', 'ku', 'en'],
        rating: 4.9,
        totalTickets: 980,
        averageResponseTime: 150 // 2.5 دقيقة
      }
    ];

    agents.forEach(agent => {
      this.availableAgents.set(agent.id, agent);
    });
  }

  private async assignAgent(sessionId: string): Promise<SupportAgent | null> {
    // البحث عن وكيل متاح
    for (const [agentId, agent] of this.availableAgents) {
      if (agent.isOnline && agent.currentChats < agent.maxConcurrentChats) {
        agent.currentChats++;
        this.availableAgents.set(agentId, agent);
        return agent;
      }
    }

    return null;
  }

  private async notifySupportTeam(ticket: SupportTicket): Promise<void> {
    // إشعار للفريق
    const agents = Array.from(this.availableAgents.values())
      .filter(agent => agent.isOnline)
      .filter(agent => this.shouldNotifyAgent(agent, ticket));

    for (const agent of agents) {
      await this.notificationService.sendNotification({
        userId: agent.id,
        type: 'system',
        title: 'تذكرة دعم جديدة',
        message: `تذكرة جديدة: ${ticket.subject}`,
        data: { ticketId: ticket.id }
      });
    }
  }

  private shouldNotifyAgent(agent: SupportAgent, ticket: SupportTicket): boolean {
    // منطق تحديد الوكيل المناسب
    if (agent.department === 'technical' && ticket.category === 'technical') return true;
    if (agent.department === 'customer_service' && ticket.category !== 'technical') return true;
    if (ticket.priority === 'urgent') return true;
    return false;
  }

  private async saveChatSession(session: LiveChatSession): Promise<void> {
    const sql = `
      INSERT INTO live_chat_sessions (
        id, user_id, agent_id, status, started_at, messages, rating, feedback
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        agent_id = $3, status = $4, ended_at = $9, messages = $6, rating = $7, feedback = $8
    `;

    await query(sql, [
      session.id,
      session.userId,
      session.agentId,
      session.status,
      session.startedAt,
      JSON.stringify(session.messages),
      session.rating,
      session.feedback,
      session.endedAt
    ]);
  }

  private async updateChatSession(session: LiveChatSession): Promise<void> {
    const sql = `
      UPDATE live_chat_sessions 
      SET agent_id = $2, status = $3, ended_at = $4, messages = $5, rating = $6, feedback = $7
      WHERE id = $1
    `;

    await query(sql, [
      session.id,
      session.agentId,
      session.status,
      session.endedAt,
      JSON.stringify(session.messages),
      session.rating,
      session.feedback
    ]);
  }

  private async saveChatMessage(message: ChatMessage): Promise<void> {
    const sql = `
      INSERT INTO chat_messages (
        id, session_id, sender_id, sender_type, content, type, timestamp, is_read
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    await query(sql, [
      message.id,
      message.sessionId,
      message.senderId,
      message.senderType,
      message.content,
      message.type,
      message.timestamp,
      message.isRead
    ]);
  }

  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      'open': 'مفتوحة',
      'in_progress': 'قيد المعالجة',
      'resolved': 'تم الحل',
      'closed': 'مغلقة'
    };
    return statusMap[status] || status;
  }

  private mapRowToTicket(row: any): SupportTicket {
    return {
      id: row.id,
      userId: row.user_id,
      category: row.category,
      priority: row.priority,
      subject: row.subject,
      description: row.description,
      attachments: row.attachments,
      status: row.status,
      assignedTo: row.assigned_to,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolvedAt: row.resolved_at,
      resolution: row.resolution,
      rating: row.rating,
      feedback: row.feedback
    };
  }

  private mapRowToArticle(row: any): KnowledgeBaseArticle {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      tags: row.tags,
      language: row.language,
      views: row.views,
      helpful: row.helpful,
      notHelpful: row.not_helpful,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      authorId: row.author_id
    };
  }
}

export default new SupportService();
