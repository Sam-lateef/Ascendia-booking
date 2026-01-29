"use client";

import React, { useState } from "react";

interface FeedbackPanelProps {
  sessionId: string;
  onClose: () => void;
  conversationMessageCount?: number;
}

/**
 * FeedbackPanel - Shows after call disconnect to collect user feedback
 */
export default function FeedbackPanel({ 
  sessionId, 
  onClose,
  conversationMessageCount = 0 
}: FeedbackPanelProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitFeedback = async () => {
    if (!rating && !comment.trim()) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          rating,
          thumbsUp: rating ? rating >= 4 : undefined,
          feedbackText: comment.trim() || undefined,
          source: 'ui',
          totalMessages: conversationMessageCount
        })
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || 'Failed to submit feedback');
      }

      setSubmitted(true);
      setTimeout(onClose, 2000); // Close after 2 seconds
      
    } catch (err: any) {
      console.error('Failed to submit feedback:', err);
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div 
          className="bg-white rounded-lg p-6 max-w-md mx-4 text-center"
          style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
        >
          <div className="text-4xl mb-4">✅</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Thank You!
          </h3>
          <p className="text-gray-600">
            Your feedback helps us improve.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div 
        className="bg-white rounded-lg p-6 max-w-md mx-4 w-full"
        style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              How was your experience?
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Your feedback helps us improve.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Star Rating */}
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Rate your experience:</p>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(rating === star ? null : star)}
                className={`text-3xl transition-transform hover:scale-110 ${
                  rating && star <= rating 
                    ? 'text-yellow-400' 
                    : 'text-gray-300 hover:text-yellow-200'
                }`}
                aria-label={`${star} star${star > 1 ? 's' : ''}`}
              >
                ★
              </button>
            ))}
          </div>
          {rating && (
            <p className="text-center text-sm text-gray-500 mt-1">
              {rating === 5 ? 'Excellent!' :
               rating === 4 ? 'Great!' :
               rating === 3 ? 'Good' :
               rating === 2 ? 'Could be better' :
               'Needs improvement'}
            </p>
          )}
        </div>

        {/* Quick Feedback Buttons */}
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Quick feedback:</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => {
                setRating(5);
                setComment('Great help!');
              }}
              className="px-4 py-2 rounded-full border border-green-300 text-green-600 hover:bg-green-50 text-sm transition-colors"
            >
              👍 Helpful
            </button>
            <button
              onClick={() => {
                setRating(2);
                setComment('Didn\'t quite get what I needed');
              }}
              className="px-4 py-2 rounded-full border border-red-300 text-red-600 hover:bg-red-50 text-sm transition-colors"
            >
              👎 Not helpful
            </button>
          </div>
        </div>

        {/* Comment Input */}
        <div className="mb-4">
          <label className="text-sm text-gray-600 mb-1 block">
            Additional comments (optional):
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What could we do better?"
            className="w-full border rounded-lg p-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 text-sm transition-colors"
          >
            Skip
          </button>
          <button
            onClick={submitFeedback}
            disabled={isSubmitting}
            className={`flex-1 px-4 py-2 rounded-lg text-white text-sm transition-colors ${
              isSubmitting 
                ? 'bg-blue-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
}


































