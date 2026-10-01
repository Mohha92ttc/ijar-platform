import { query } from '../database/connection';

export interface UserPreferences {
  userId: string;
  language: string;
  theme: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  preferredCategories: string[];
  preferredLocations: string[];
  priceRange: {
    min: number;
    max: number | null;
  };
}

export interface UserActivity {
  userId: string;
  activityType: 'view' | 'search' | 'booking' | 'review' | 'favorite';
  activityData: any;
  timestamp: Date;
}

export interface Recommendation {
  equipmentId: string;
  score: number;
  reason: string;
}

export class PersonalizationService {
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const sql = `
      SELECT user_id, language, theme, email_notifications, sms_notifications, 
             push_notifications, preferred_categories, preferred_locations, price_range
      FROM user_preferences 
      WHERE user_id = $1
    `;
    
    const result = await query(sql, [userId]);
    
    if (result.rows.length === 0) {
      // Create default preferences
      return await this.createDefaultPreferences(userId);
    }
    
    return this.mapRowToPreferences(result.rows[0]);
  }

  async updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<void> {
    const sql = `
      UPDATE user_preferences 
      SET language = COALESCE($2, language),
          theme = COALESCE($3, theme),
          email_notifications = COALESCE($4, email_notifications),
          sms_notifications = COALESCE($5, sms_notifications),
          push_notifications = COALESCE($6, push_notifications),
          preferred_categories = COALESCE($7, preferred_categories),
          preferred_locations = COALESCE($8, preferred_locations),
          price_range = COALESCE($9, price_range),
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;
    
    await query(sql, [
      userId,
      preferences.language,
      preferences.theme,
      preferences.emailNotifications,
      preferences.smsNotifications,
      preferences.pushNotifications,
      JSON.stringify(preferences.preferredCategories || []),
      JSON.stringify(preferences.preferredLocations || []),
      JSON.stringify(preferences.priceRange || { min: 0, max: null })
    ]);
  }

  async createDefaultPreferences(userId: string): Promise<UserPreferences> {
    const sql = `
      INSERT INTO user_preferences (
        user_id, language, theme, email_notifications, sms_notifications, 
        push_notifications, preferred_categories, preferred_locations, price_range
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const defaultPrefs = {
      language: 'ar',
      theme: 'light',
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
      preferredCategories: [],
      preferredLocations: [],
      priceRange: { min: 0, max: null }
    };
    
    const result = await query(sql, [
      userId,
      defaultPrefs.language,
      defaultPrefs.theme,
      defaultPrefs.emailNotifications,
      defaultPrefs.smsNotifications,
      defaultPrefs.pushNotifications,
      JSON.stringify(defaultPrefs.preferredCategories),
      JSON.stringify(defaultPrefs.preferredLocations),
      JSON.stringify(defaultPrefs.priceRange)
    ]);
    
    return this.mapRowToPreferences(result.rows[0]);
  }

  async trackUserActivity(activity: UserActivity): Promise<void> {
    const sql = `
      INSERT INTO user_activity (user_id, activity_type, activity_data, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5)
    `;
    
    await query(sql, [
      activity.userId,
      activity.activityType,
      JSON.stringify(activity.activityData),
      activity.activityData?.ipAddress || null,
      activity.activityData?.userAgent || null
    ]);
  }

  async getUserActivityHistory(userId: string, limit: number = 100): Promise<UserActivity[]> {
    const sql = `
      SELECT user_id, activity_type, activity_data, created_at as timestamp
      FROM user_activity 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    
    const result = await query(sql, [userId, limit]);
    return result.rows.map(row => ({
      userId: row.user_id,
      activityType: row.activity_type,
      activityData: row.activity_data,
      timestamp: row.timestamp
    }));
  }

  async getPersonalizedRecommendations(userId: string, limit: number = 10): Promise<Recommendation[]> {
    const preferences = await this.getUserPreferences(userId);
    const activityHistory = await this.getUserActivityHistory(userId, 50);
    
    // Analyze user behavior patterns
    const behaviorAnalysis = this.analyzeUserBehavior(activityHistory);
    
    // Get suitable equipment based on preferences and behavior
    const recommendations = await this.generateRecommendations(preferences, behaviorAnalysis, limit);
    
    return recommendations;
  }

  private analyzeUserBehavior(activityHistory: UserActivity[]): any {
    const analysis = {
      preferredCategories: {} as Record<string, number>,
      preferredLocations: {} as Record<string, number>,
      priceRange: { min: Infinity, max: 0 },
      bookingFrequency: 0,
      searchPatterns: [] as string[],
      favoriteCategories: [] as string[],
      averageSessionDuration: 0
    };

    let sessionStart: Date | null = null;
    let totalSessionTime = 0;
    let sessionCount = 0;

    activityHistory.forEach(activity => {
      const data = activity.activityData;
      
      // Track categories
      if (data.category) {
        analysis.preferredCategories[data.category] = (analysis.preferredCategories[data.category] || 0) + 1;
      }
      
      // Track locations
      if (data.location) {
        analysis.preferredLocations[data.location] = (analysis.preferredLocations[data.location] || 0) + 1;
      }
      
      // Track price range
      if (data.price) {
        analysis.priceRange.min = Math.min(analysis.priceRange.min, data.price);
        analysis.priceRange.max = Math.max(analysis.priceRange.max, data.price);
      }
      
      // Track booking frequency
      if (activity.activityType === 'booking') {
        analysis.bookingFrequency++;
      }
      
      // Track search patterns
      if (activity.activityType === 'search' && data.searchTerm) {
        analysis.searchPatterns.push(data.searchTerm);
      }
      
      // Track favorites
      if (activity.activityType === 'favorite' && data.category) {
        if (!analysis.favoriteCategories.includes(data.category)) {
          analysis.favoriteCategories.push(data.category);
        }
      }
      
      // Track session duration
      if (activity.activityType === 'view' && !sessionStart) {
        sessionStart = activity.timestamp;
      } else if (activity.activityType === 'view' && sessionStart) {
        const sessionDuration = activity.timestamp.getTime() - sessionStart.getTime();
        totalSessionTime += sessionDuration;
        sessionCount++;
        sessionStart = null;
      }
    });

    if (sessionCount > 0) {
      analysis.averageSessionDuration = totalSessionTime / sessionCount;
    }

    // Reset min price if it wasn't updated
    if (analysis.priceRange.min === Infinity) {
      analysis.priceRange.min = 0;
    }

    return analysis;
  }

  private async generateRecommendations(preferences: UserPreferences, behaviorAnalysis: any, limit: number): Promise<Recommendation[]> {
    // Combine user preferences with behavior analysis
    const combinedCategories = this.combineCategories(
      preferences.preferredCategories,
      Object.keys(behaviorAnalysis.preferredCategories).reduce((acc, cat) => {
        acc[cat] = behaviorAnalysis.preferredCategories[cat];
        return acc;
      }, {} as Record<string, number>)
    );
    
    const combinedLocations = this.combineLocations(
      preferences.preferredLocations,
      Object.keys(behaviorAnalysis.preferredLocations).reduce((acc, loc) => {
        acc[loc] = behaviorAnalysis.preferredLocations[loc];
        return acc;
      }, {} as Record<string, number>)
    );
    
    const priceRange = this.combinePriceRanges(
      preferences.priceRange,
      behaviorAnalysis.priceRange
    );

    // Get equipment that matches the criteria
    const sql = `
      SELECT e.id, e.title, e.category, e.price_per_day, e.location, e.average_rating,
             CASE 
               WHEN $1::text[] IS NOT NULL AND e.category = ANY($1::text[]) THEN 0.3
               WHEN $2::text[] IS NOT NULL AND e.location = ANY($2::text[]) THEN 0.2
               WHEN e.price_per_day >= $3 AND e.price_per_day <= $4 THEN 0.2
               WHEN e.average_rating >= 4.5 THEN 0.1
               ELSE 0
             END +
             CASE 
               WHEN e.average_rating >= 4.5 THEN e.average_rating / 5
               ELSE e.average_rating / 10
             END +
             CASE 
               WHEN e.review_count >= 10 THEN 0.1
               ELSE 0
             END as score
      FROM equipment e
      WHERE e.status = 'available'
      ORDER BY score DESC, e.average_rating DESC
      LIMIT $5
    `;
    
    const result = await query(sql, [
      combinedCategories.length > 0 ? combinedCategories : null,
      combinedLocations.length > 0 ? combinedLocations : null,
      priceRange.min,
      priceRange.max || 999999999
    ]);
    
    return result.rows.map(row => ({
      equipmentId: row.id,
      score: parseFloat(row.score),
      reason: this.generateRecommendationReason(row, preferences, behaviorAnalysis)
    }));
  }

  private combineCategories(preferred: string[], behavior: Record<string, number>): string[] {
    const combined = [...new Set([...preferred, ...Object.keys(behavior)])];
    return combined.slice(0, 10); // Limit to top 10 categories
  }

  private combineLocations(preferred: string[], behavior: Record<string, number>): string[] {
    const combined = [...new Set([...preferred, ...Object.keys(behavior)])];
    return combined.slice(0, 10); // Limit to top 10 locations
  }

  private combinePriceRanges(prefRange: any, behaviorRange: any): { min: number; max: number | null } {
    return {
      min: Math.min(prefRange.min || 0, behaviorRange.min || 0),
      max: Math.max(
        prefRange.max || 999999999,
        behaviorRange.max || 999999999
      )
    };
  }

  private generateRecommendationReason(equipment: any, preferences: UserPreferences, behavior: any): string {
    const reasons = [];
    
    if (preferences.preferredCategories.includes(equipment.category)) {
      reasons.push('مطابق لفئاتك المفضلة');
    }
    
    if (Object.keys(behavior.preferredCategories).includes(equipment.category)) {
      reasons.push('شائع في عمليات البحث');
    }
    
    if (equipment.average_rating >= 4.5) {
      reasons.push('تقييم عالي');
    }
    
    if (equipment.review_count >= 10) {
      reasons.push('شائع التقييم');
    }
    
    if (equipment.price_per_day >= (preferences.priceRange?.min || 0) && 
        equipment.price_per_day <= (preferences.priceRange?.max || 999999999)) {
      reasons.push('ضمناسب لنطاق السعر');
    }
    
    return reasons.length > 0 ? reasons.join('، ') : 'موصى بناءً على تقييمات عالية';
  }

  async getPersonalizedContent(userId: string): Promise<any> {
    const preferences = await this.getUserPreferences(userId);
    const recommendations = await this.getPersonalizedRecommendations(userId, 5);
    
    return {
      language: preferences.language,
      theme: preferences.theme,
      recommendations,
      featuredCategories: preferences.preferredCategories.slice(0, 3),
      featuredLocations: preferences.preferredLocations.slice(0, 3)
    };
  }

  async updatePersonalizationModel(userId: string): Promise<void> {
    // This would integrate with a machine learning model
    // For now, we'll just update user activity weights
    const sql = `
      UPDATE user_activity 
      SET weight = weight + 1 
      WHERE user_id = $1 
      AND created_at > NOW() - INTERVAL '30 days'
    `;
    
    await query(sql, [userId]);
  }

  private mapRowToPreferences(row: any): UserPreferences {
    return {
      userId: row.user_id,
      language: row.language,
      theme: row.theme,
      emailNotifications: row.email_notifications,
      smsNotifications: row.sms_notifications,
      pushNotifications: row.push_notifications,
      preferredCategories: row.preferred_categories || [],
      preferredLocations: row.preferred_locations || [],
      priceRange: row.price_range || { min: 0, max: null }
    };
  }
}

export default new PersonalizationService();
