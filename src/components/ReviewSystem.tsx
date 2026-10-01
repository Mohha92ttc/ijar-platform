import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star, MessageSquare, ThumbsUp, ThumbsDown, Flag, Send } from 'lucide-react';

interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  date: string;
  helpful: number;
  notHelpful: number;
  response?: {
    text: string;
    date: string;
    responder: string;
  };
}

interface ReviewSystemProps {
  equipmentId: string;
  equipmentName: string;
  partnerName: string;
  averageRating: number;
  totalReviews: number;
  onReviewSubmit?: (review: any) => void;
}

export default function ReviewSystem({ 
  equipmentId, 
  equipmentName, 
  partnerName, 
  averageRating, 
  totalReviews,
  onReviewSubmit 
}: ReviewSystemProps) {
  const [reviews, setReviews] = useState<Review[]>([
    {
      id: 'r1',
      userId: 'u1',
      userName: 'محمد أحمد',
      rating: 5,
      comment: 'ممتاز! المعدة كانت بحالة ممتازة والتسليم كان في الوقت المحدد. أنصح بالتعامل مع هذا الشريك.',
      date: '2026-04-01',
      helpful: 12,
      notHelpful: 1,
      response: {
        text: 'شكراً لتقييمك يا محمد. سعدنا بخدمتك ونتمنى التعامل معك مرة أخرى.',
        date: '2026-04-02',
        responder: partnerName
      }
    },
    {
      id: 'r2',
      userId: 'u2',
      userName: 'فاطمة علي',
      rating: 4,
      comment: 'جيدة جداً، السعر كان معقولاً والمعدة تعمل بشكل جيد. فقط تأخر التسليم بساعة واحدة.',
      date: '2026-03-28',
      helpful: 8,
      notHelpful: 2
    },
    {
      id: 'r3',
      userId: 'u3',
      userName: 'عمر حسين',
      rating: 5,
      comment: 'خدمة ممتازة ومعدات عالية الجودة. سأستأجر منهم مرة أخرى بالتأكيد.',
      date: '2026-03-25',
      helpful: 15,
      notHelpful: 0
    }
  ]);

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [newReview, setNewReview] = useState({
    rating: 0,
    comment: ''
  });
  const [hoveredRating, setHoveredRating] = useState(0);

  const handleSubmitReview = () => {
    if (newReview.rating === 0 || !newReview.comment.trim()) {
      alert('الرجاء اختيار تقييم وكتابة تعليق');
      return;
    }

    const review: Review = {
      id: `r${Date.now()}`,
      userId: 'current-user',
      userName: 'المستخدم الحالي',
      rating: newReview.rating,
      comment: newReview.comment,
      date: new Date().toISOString().split('T')[0],
      helpful: 0,
      notHelpful: 0
    };

    setReviews([review, ...reviews]);
    setNewReview({ rating: 0, comment: '' });
    setShowReviewForm(false);
    
    if (onReviewSubmit) {
      onReviewSubmit(review);
    }
  };

  const handleHelpful = (reviewId: string, type: 'helpful' | 'notHelpful') => {
    setReviews(reviews.map(review => 
      review.id === reviewId 
        ? { ...review, [type]: review[type] + 1 }
        : review
    ));
  };

  const renderStars = (rating: number, interactive = false, size = 'normal') => {
    const sizeClass = size === 'small' ? 'w-4 h-4' : 'w-5 h-5';
    
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= (interactive ? hoveredRating : rating)
                ? 'text-amber-400 fill-current'
                : 'text-slate-300'
            }`}
            onClick={interactive ? () => setNewReview({ ...newReview, rating: star }) : undefined}
            onMouseEnter={interactive ? () => setHoveredRating(star) : undefined}
            onMouseLeave={interactive ? () => setHoveredRating(newReview.rating) : undefined}
          />
        ))}
      </div>
    );
  };

  const ratingDistribution = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: reviews.filter(r => r.rating === rating).length,
    percentage: (reviews.filter(r => r.rating === rating).length / reviews.length) * 100
  }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">التقييمات والمراجعات</h3>
        <button
          onClick={() => setShowReviewForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <MessageSquare size={16} />
          إضافة تقييم
        </button>
      </div>

      {/* Rating Summary */}
      <div className="grid md:grid-cols-2 gap-6 mb-8 p-4 bg-slate-50 rounded-xl">
        <div className="text-center">
          <div className="text-4xl font-bold text-slate-800 mb-2">{averageRating.toFixed(1)}</div>
          {renderStars(Math.round(averageRating))}
          <div className="text-sm text-slate-500 mt-2">{totalReviews} تقييم</div>
        </div>
        
        <div className="space-y-2">
          {ratingDistribution.map(({ rating, count, percentage }) => (
            <div key={rating} className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-16">
                <span className="text-sm">{rating}</span>
                <Star className="w-4 h-4 text-amber-400 fill-current" />
              </div>
              <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-amber-400 h-full rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="text-sm text-slate-600 w-8">{count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Review Form */}
      {showReviewForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 border border-slate-200 rounded-xl"
        >
          <h4 className="font-bold mb-4">إضافة تقييم جديد</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">التقييم</label>
              <div className="flex gap-1">
                {renderStars(newReview.rating, true)}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">التعليق</label>
              <textarea
                value={newReview.comment}
                onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                placeholder="شارك تجربتك مع هذه المعدة..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none"
                rows={4}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSubmitReview}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Send size={16} />
                إرسال التقييم
              </button>
              <button
                onClick={() => setShowReviewForm(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="border-b border-slate-100 pb-4 last:border-0">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                {review.userName[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-bold text-slate-800">{review.userName}</div>
                    <div className="text-sm text-slate-500">{review.date}</div>
                  </div>
                  {renderStars(review.rating, false, 'small')}
                </div>
                <p className="text-slate-700 mb-3">{review.comment}</p>
                
                {/* Partner Response */}
                {review.response && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-blue-800">{review.response.responder}</span>
                      <span className="text-xs text-blue-600">رد</span>
                    </div>
                    <p className="text-sm text-blue-700">{review.response.text}</p>
                    <div className="text-xs text-blue-600 mt-1">{review.response.date}</div>
                  </div>
                )}
                
                {/* Helpful Buttons */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleHelpful(review.id, 'helpful')}
                      className="flex items-center gap-1 text-sm text-slate-600 hover:text-green-600"
                    >
                      <ThumbsUp size={14} />
                      مفيد ({review.helpful})
                    </button>
                    <button
                      onClick={() => handleHelpful(review.id, 'notHelpful')}
                      className="flex items-center gap-1 text-sm text-slate-600 hover:text-red-600"
                    >
                      <ThumbsDown size={14} />
                      غير مفيد ({review.notHelpful})
                    </button>
                  </div>
                  <button className="flex items-center gap-1 text-sm text-slate-600 hover:text-amber-600">
                    <Flag size={14} />
                    إبلاغ
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {reviews.length === 0 && (
        <div className="text-center py-8">
          <MessageSquare className="mx-auto text-slate-400 mb-4" size={48} />
          <h4 className="text-lg font-bold text-slate-700 mb-2">لا توجد تقييمات بعد</h4>
          <p className="text-slate-500">كن أول من يقيم {equipmentName}</p>
        </div>
      )}
    </div>
  );
}
