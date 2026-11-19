import React, { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Star, ThumbsUp, Sliders } from 'lucide-react';

export type VisitorReview = {
  id: string;
  episode_id: string;
  author: string;
  rating: number;
  scale: 'stars' | 'points';
  terminology: string;
  content: string;
  likes: number;
  created_at: string;
};

export interface VisitorReviewsSectionProps {
  episodeId: string;
}

function readLikedSet(items: VisitorReview[]): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  const next = new Set<string>();
  for (const item of items) {
    if (localStorage.getItem(`liked_${item.id}`) === 'true') {
      next.add(item.id);
    }
  }
  return next;
}

export function VisitorReviewsSection({ episodeId }: VisitorReviewsSectionProps) {
  const [reviews, setReviews] = useState<VisitorReview[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [formAuthor, setFormAuthor] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formRating, setFormRating] = useState(4);
  const [formScale, setFormScale] = useState<'stars' | 'points'>('stars');
  const [formTerminology, setFormTerminology] = useState('Giggitys');
  const [submitFeedback, setSubmitFeedback] = useState<{
    tone: 'success' | 'local' | 'error';
    message: string;
  } | null>(null);

  const loadReviews = async () => {
    setLoading(true);
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('visitor_reviews')
          .select('*')
          .eq('episode_id', episodeId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data) {
          setReviews(data);
          setLikedIds(readLikedSet(data));
          return;
        }
      }
      throw new Error('No supabase client');
    } catch {
      const stored =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem(`visitor_reviews_${episodeId}`)
          : null;
      const parsed: VisitorReview[] = stored ? JSON.parse(stored) : [];
      setReviews(parsed);
      setLikedIds(readLikedSet(parsed));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId]);

  const handleScaleToggle = (newScale: 'stars' | 'points') => {
    setFormScale(newScale);
    if (newScale === 'stars') {
      setFormRating(Math.round((formRating / 100) * 5) || 1);
    } else {
      setFormRating(Math.round((formRating / 5) * 100) || 80);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAuthor.trim() || !formContent.trim()) {
      setSubmitFeedback({
        tone: 'error',
        message: 'Please add both your alias and a comment before posting.',
      });
      return;
    }

    setSubmitFeedback(null);

    const payload = {
      episode_id: episodeId,
      author: formAuthor.trim(),
      rating: Number(formRating),
      scale: formScale,
      terminology: formTerminology.trim() || (formScale === 'stars' ? 'Stars' : 'Points'),
      content: formContent.trim(),
      likes: 0,
    };

    try {
      if (supabase) {
        const { data, error } = await supabase.from('visitor_reviews').insert([payload]).select();
        if (error) throw error;
        if (data && data[0]) {
          setReviews((prev) => [data[0], ...prev]);
        } else {
          await loadReviews();
        }
        setSubmitFeedback({
          tone: 'success',
          message: 'Review posted live!',
        });
      } else {
        throw new Error('Supabase client unavailable');
      }
    } catch {
      console.warn('Falling back to local storage');
      const localItem: VisitorReview = {
        id: 'local-' + Date.now(),
        created_at: new Date().toISOString(),
        ...payload,
      };
      const updated = [localItem, ...reviews];
      setReviews(updated);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`visitor_reviews_${episodeId}`, JSON.stringify(updated));
      }
      setSubmitFeedback({
        tone: 'local',
        message: "Saved on this device only — couldn't reach the server right now.",
      });
    }

    setFormAuthor('');
    setFormContent('');
  };

  const handleToggleLike = async (id: string) => {
    const target = reviews.find((r) => r.id === id);
    if (!target) return;

    const likedKey = `liked_${id}`;
    const isLiked = likedIds.has(id);
    const nextLikes = isLiked ? Math.max(0, target.likes - 1) : target.likes + 1;

    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, likes: nextLikes } : r)));
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (isLiked) next.delete(id);
      else next.add(id);
      return next;
    });

    if (typeof localStorage !== 'undefined') {
      if (isLiked) {
        localStorage.removeItem(likedKey);
      } else {
        localStorage.setItem(likedKey, 'true');
      }
    }

    try {
      if (supabase && !id.startsWith('local-')) {
        await supabase.from('visitor_reviews').update({ likes: nextLikes }).eq('id', id);
      } else if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(`visitor_reviews_${episodeId}`);
        if (stored) {
          const parsed: VisitorReview[] = JSON.parse(stored);
          localStorage.setItem(
            `visitor_reviews_${episodeId}`,
            JSON.stringify(parsed.map((r) => (r.id === id ? { ...r, likes: nextLikes } : r)))
          );
        }
      }
    } catch (err) {
      console.warn('Failed to sync like count:', err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-8 text-[#1a1a1a]">
      <div className="lg:col-span-7 space-y-4">
        <div className="inline-block bg-[#A7F3D0] border-2 border-[#1a1a1a] px-3 py-1.5 rounded-md shadow-[2px_2px_0_#1a1a1a]">
          <h2 className="text-lg uppercase tracking-wide text-[#1a1a1a]">USER COMMUNITY FEED</h2>
        </div>

        {loading ? (
          <div className="p-4 text-center font-bold text-[#1a1a1a]" role="status">
            Loading comments...
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-white border-2 border-[#1a1a1a] rounded-lg p-6 text-center shadow-[3px_3px_0_#1a1a1a]">
            <p className="font-bold text-sm text-[#1a1a1a]">
              No reviews posted yet! Use the composer on the right to post yours.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const dateStr = new Date(review.created_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
              const isLiked = likedIds.has(review.id);

              return (
                <div
                  key={review.id}
                  className="flex gap-3 items-start bg-white border-2 border-[#1a1a1a] rounded-lg p-4 relative shadow-[3px_3px_0_#1a1a1a]"
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 border-2 border-[#1a1a1a] rounded-md bg-[#ff72c7] flex items-center justify-center font-black text-sm uppercase text-[#1a1a1a]">
                      {review.author[0] || '?'}
                    </div>
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-black text-sm underline decoration-[#ff72c7] decoration-2 truncate">
                        {review.author}
                      </span>
                      <span className="text-xs font-bold text-[#4a4a4a] flex-shrink-0">
                        {dateStr}
                      </span>
                    </div>

                    <div className="inline-block bg-yellow-100 border-2 border-[#1a1a1a] px-2 py-1 text-xs font-black mb-2 rounded">
                      {review.scale === 'stars' ? (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span>Rating:</span>
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                size={12}
                                fill={s <= review.rating ? '#F59E0B' : 'transparent'}
                                className="text-[#1a1a1a]"
                                aria-hidden="true"
                              />
                            ))}
                          </div>
                          <span className="ml-1 text-[#7a2b0f]">
                            ({review.rating}/5 {review.terminology})
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>Score:</span>
                          <div className="w-14 bg-white border border-[#1a1a1a] h-2.5 relative overflow-hidden">
                            <div
                              className="bg-[#ff72c7] h-full border-r border-[#1a1a1a]"
                              style={{ width: `${review.rating}%` }}
                            />
                          </div>
                          <span className="text-[#7a2b0f] font-black">
                            {review.rating}/100 {review.terminology}
                          </span>
                        </div>
                      )}
                    </div>

                    <p className="text-sm font-medium text-[#1a1a1a] leading-relaxed mb-3 whitespace-pre-wrap break-words">
                      {review.content}
                    </p>

                    <div className="flex items-center gap-3 border-t border-dashed border-gray-200 pt-2">
                      <button
                        type="button"
                        onClick={() => handleToggleLike(review.id)}
                        aria-pressed={isLiked}
                        className={`flex items-center gap-1.5 min-h-[44px] text-xs font-bold px-3 py-1.5 border-2 border-[#1a1a1a] rounded shadow-[1.5px_1.5px_0px_0px_#1a1a1a] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-colors focus-visible:outline-2 focus-visible:outline-[#1a1a1a] focus-visible:outline-offset-2 ${
                          isLiked ? 'bg-[#ff72c7] text-[#1a1a1a]' : 'bg-white hover:bg-[#f5f4f0]'
                        }`}
                      >
                        <ThumbsUp size={14} aria-hidden="true" />
                        <span>{review.likes} Helpful</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="lg:col-span-5">
        <div className="bg-[#ff72c7] border-2 border-[#1a1a1a] p-4 rounded-lg shadow-[4px_4px_0_#1a1a1a]">
          <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-[#1a1a1a]">
            <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-1.5 text-[#1a1a1a]">
              <Sliders size={16} aria-hidden="true" /> WRITE A REVIEW
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div>
              <label
                htmlFor="visitor-author"
                className="block text-xs font-black uppercase mb-1 text-[#1a1a1a]"
              >
                Your Alias
              </label>
              <input
                id="visitor-author"
                type="text"
                required
                value={formAuthor}
                onChange={(e) => setFormAuthor(e.target.value)}
                placeholder="e.g. MegIsGreat99"
                className="w-full min-h-[44px] bg-white border-2 border-[#1a1a1a] rounded px-3 py-2 font-bold focus-visible:outline-2 focus-visible:outline-[#1a1a1a] focus-visible:outline-offset-2 focus:bg-yellow-50 text-xs text-[#1a1a1a]"
              />
            </div>

            <div>
              <span
                id="visitor-scale-label"
                className="block text-xs font-black uppercase mb-1 text-[#1a1a1a]"
              >
                Choose Score System
              </span>
              <div
                className="grid grid-cols-2 gap-1.5"
                role="group"
                aria-labelledby="visitor-scale-label"
              >
                <button
                  type="button"
                  onClick={() => handleScaleToggle('stars')}
                  aria-pressed={formScale === 'stars'}
                  className={`min-h-[44px] py-2 px-2 border-2 border-[#1a1a1a] rounded font-black text-xs uppercase tracking-wider transition-colors focus-visible:outline-2 focus-visible:outline-[#1a1a1a] focus-visible:outline-offset-2 ${
                    formScale === 'stars'
                      ? 'bg-yellow-300 text-[#1a1a1a] shadow-[1.5px_1.5px_0px_0px_#1a1a1a]'
                      : 'bg-white text-[#1a1a1a] hover:bg-[#f5f4f0]'
                  }`}
                >
                  5-Star Scale
                </button>
                <button
                  type="button"
                  onClick={() => handleScaleToggle('points')}
                  aria-pressed={formScale === 'points'}
                  className={`min-h-[44px] py-2 px-2 border-2 border-[#1a1a1a] rounded font-black text-xs uppercase tracking-wider transition-colors focus-visible:outline-2 focus-visible:outline-[#1a1a1a] focus-visible:outline-offset-2 ${
                    formScale === 'points'
                      ? 'bg-yellow-300 text-[#1a1a1a] shadow-[1.5px_1.5px_0px_0px_#1a1a1a]'
                      : 'bg-white text-[#1a1a1a] hover:bg-[#f5f4f0]'
                  }`}
                >
                  100-Point Scale
                </button>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <label
                  htmlFor="visitor-terminology"
                  className="block text-xs font-black uppercase text-[#1a1a1a]"
                >
                  Scale Terminology
                </label>
                <a
                  href="/glossary#arbitrary-rating-units"
                  className="text-xs font-bold underline text-[#1a1a1a] hover:text-[#7a2b0f]"
                >
                  What's this? &rarr; Glossary
                </a>
              </div>
              <input
                id="visitor-terminology"
                type="text"
                required
                value={formTerminology}
                onChange={(e) => setFormTerminology(e.target.value)}
                placeholder="e.g. Giggitys, Peter Points..."
                className="w-full min-h-[44px] bg-white border-2 border-[#1a1a1a] rounded px-3 py-2 font-bold focus-visible:outline-2 focus-visible:outline-[#1a1a1a] focus-visible:outline-offset-2 focus:bg-yellow-50 text-xs text-[#1a1a1a]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor={formScale === 'points' ? 'visitor-score-range' : undefined}
                  id="visitor-score-label"
                  className="block text-xs font-black uppercase text-[#1a1a1a]"
                >
                  Your Score
                </label>
                <span className="font-black text-xs bg-[#1a1a1a] text-white px-2 py-0.5 border border-[#1a1a1a] rounded">
                  {formRating} {formTerminology || 'Points'}
                </span>
              </div>

              {formScale === 'stars' ? (
                <div
                  className="flex items-center gap-1.5 bg-white border-2 border-[#1a1a1a] rounded p-1.5 justify-center"
                  role="group"
                  aria-labelledby="visitor-score-label"
                >
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setFormRating(num)}
                      aria-label={`Rate ${num} out of 5`}
                      aria-pressed={num === formRating}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded hover:scale-110 transition-transform focus-visible:outline-2 focus-visible:outline-[#1a1a1a] focus-visible:outline-offset-2"
                    >
                      <Star
                        size={22}
                        fill={num <= formRating ? '#F59E0B' : 'transparent'}
                        className="stroke-[2] text-[#1a1a1a]"
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-white border-2 border-[#1a1a1a] rounded p-3 flex flex-col gap-2">
                  <input
                    id="visitor-score-range"
                    type="range"
                    min="1"
                    max="100"
                    value={formRating}
                    onChange={(e) => setFormRating(Number(e.target.value))}
                    aria-label="Score out of 100"
                    className="w-full min-h-[24px] cursor-pointer accent-[#ff72c7]"
                  />
                  <div className="flex justify-between text-xs font-bold text-[#1a1a1a]">
                    <span>1 (Trash)</span>
                    <span>50 (Meh)</span>
                    <span>100 (Masterpiece)</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label
                htmlFor="visitor-comments"
                className="block text-xs font-black uppercase mb-1 text-[#1a1a1a]"
              >
                Comments
              </label>
              <textarea
                id="visitor-comments"
                required
                rows={3}
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Give us your worst, Peter style..."
                className="w-full min-h-[44px] bg-white border-2 border-[#1a1a1a] rounded p-2.5 font-bold focus-visible:outline-2 focus-visible:outline-[#1a1a1a] focus-visible:outline-offset-2 focus:bg-yellow-50 text-xs text-[#1a1a1a]"
              />
            </div>

            {submitFeedback ? (
              <div
                role="status"
                aria-live="polite"
                className={`rounded border-2 border-[#1a1a1a] px-3 py-2 text-xs font-bold ${
                  submitFeedback.tone === 'error'
                    ? 'bg-[#fee2e2] text-[#5c1a1a]'
                    : submitFeedback.tone === 'local'
                      ? 'bg-yellow-100 text-[#1a1a1a]'
                      : 'bg-[#A7F3D0] text-[#1a1a1a]'
                }`}
              >
                {submitFeedback.message}
              </div>
            ) : null}

            <button
              type="submit"
              className="w-full min-h-[44px] bg-[#1a1a1a] text-white hover:bg-[#7a2b0f] border-2 border-[#1a1a1a] rounded p-2.5 text-xs font-black uppercase tracking-wider transition-colors shadow-[2px_2px_0px_0px_#FFFFFF] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-2 focus-visible:outline-[#1a1a1a] focus-visible:outline-offset-2"
            >
              POST REVIEW LIVE
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default VisitorReviewsSection;
