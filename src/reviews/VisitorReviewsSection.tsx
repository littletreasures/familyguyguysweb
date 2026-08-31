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

export function VisitorReviewsSection({ episodeId }: VisitorReviewsSectionProps) {
  const [reviews, setReviews] = useState<VisitorReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [formAuthor, setFormAuthor] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formRating, setFormRating] = useState(4);
  const [formScale, setFormScale] = useState<'stars' | 'points'>('stars');
  const [formTerminology, setFormTerminology] = useState('Giggitys');

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
          return;
        }
      }
      throw new Error('No supabase client');
    } catch (err) {
      const stored = localStorage.getItem(`visitor_reviews_${episodeId}`);
      setReviews(stored ? JSON.parse(stored) : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
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
    if (!formAuthor.trim() || !formContent.trim()) return;

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
      } else {
        throw new Error();
      }
    } catch (err) {
      console.warn('Falling back to local storage');
      const localItem: VisitorReview = {
        id: 'local-' + Date.now(),
        created_at: new Date().toISOString(),
        ...payload,
      };
      const updated = [localItem, ...reviews];
      setReviews(updated);
      localStorage.setItem(`visitor_reviews_${episodeId}`, JSON.stringify(updated));
    }

    setFormAuthor('');
    setFormContent('');
  };

  const handleToggleLike = async (id: string) => {
    const target = reviews.find((r) => r.id === id);
    if (!target) return;

    const likedKey = `liked_${id}`;
    const isLiked = localStorage.getItem(likedKey) === 'true';
    const nextLikes = isLiked ? target.likes - 1 : target.likes + 1;

    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, likes: nextLikes } : r)));
    if (isLiked) {
      localStorage.removeItem(likedKey);
    } else {
      localStorage.setItem(likedKey, 'true');
    }

    try {
      if (supabase && !id.startsWith('local-')) {
        await supabase.from('visitor_reviews').update({ likes: nextLikes }).eq('id', id);
      } else {
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-8 text-black">
      <div className="lg:col-span-7 space-y-4">
        <div className="inline-block bg-[#A7F3D0] border-2 border-black px-3 py-1.5 rounded-md">
          <h3 className="text-md font-black uppercase tracking-wide">USER COMMUNITY FEED</h3>
        </div>

        {loading ? (
          <div className="p-4 text-center font-bold">Loading comments...</div>
        ) : reviews.length === 0 ? (
          <div className="bg-white border-2 border-black rounded-lg p-6 text-center">
            <p className="font-black text-sm">
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
              const likedKey = `liked_${review.id}`;
              const isLiked = localStorage.getItem(likedKey) === 'true';

              return (
                <div
                  key={review.id}
                  className="flex gap-3 items-start bg-white border-2 border-black rounded-lg p-4 relative transition-transform duration-100"
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 border-2 border-black rounded-md bg-pink-300 flex items-center justify-center font-black text-sm uppercase">
                      {review.author[0] || '?'}
                    </div>
                  </div>

                  <div className="flex-grow min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-black text-sm underline decoration-pink-500 decoration-2 truncate">
                        {review.author}
                      </span>
                      <span className="text-[10px] font-bold text-gray-500 flex-shrink-0">
                        {dateStr}
                      </span>
                    </div>

                    <div className="inline-block bg-yellow-100 border-2 border-black px-1.5 py-0.5 text-[10px] font-black mb-2">
                      {review.scale === 'stars' ? (
                        <div className="flex items-center gap-1">
                          <span>Rating:</span>
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                size={10}
                                fill={s <= review.rating ? '#F59E0B' : 'transparent'}
                                className="text-black"
                              />
                            ))}
                          </div>
                          <span className="ml-1 text-pink-600">
                            ({review.rating}/5 {review.terminology})
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span>Score:</span>
                          <div className="w-14 bg-white border border-black h-2.5 relative overflow-hidden">
                            <div
                              className="bg-pink-500 h-full border-r border-black"
                              style={{ width: `${review.rating}%` }}
                            />
                          </div>
                          <span className="text-pink-600 font-black">
                            {review.rating}/100 {review.terminology}
                          </span>
                        </div>
                      )}
                    </div>

                    <p className="text-xs font-bold text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap break-words">
                      {review.content}
                    </p>

                    <div className="flex items-center gap-3 border-t border-dashed border-gray-200 pt-2">
                      <button
                        onClick={() => handleToggleLike(review.id)}
                        className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 border border-black shadow-[1.5px_1.5px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-colors ${
                          isLiked ? 'bg-pink-300 text-black' : 'bg-white hover:bg-gray-100'
                        }`}
                      >
                        <ThumbsUp size={10} />
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
        <div className="bg-[#F472B6] border-2 border-black p-4 rounded-lg">
          <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-black">
            <h4 className="text-md font-black uppercase tracking-tight flex items-center gap-1.5">
              <Sliders size={16} /> WRITE A REVIEW
            </h4>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[10px] font-black uppercase mb-1">Your Alias</label>
              <input
                type="text"
                required
                value={formAuthor}
                onChange={(e) => setFormAuthor(e.target.value)}
                placeholder="e.g. MegIsGreat99"
                className="w-full bg-white border-2 border-black p-1.5 font-black focus:outline-none focus:bg-yellow-50 text-xs"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase mb-1">
                Choose Score System
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleScaleToggle('stars')}
                  className={`py-1.5 px-2 border-2 border-black font-black text-[10px] uppercase tracking-wider transition-colors ${
                    formScale === 'stars'
                      ? 'bg-yellow-300 text-black shadow-[1.5px_1.5px_0px_0px_#000000]'
                      : 'bg-white hover:bg-gray-100'
                  }`}
                >
                  5-Star Scale
                </button>
                <button
                  type="button"
                  onClick={() => handleScaleToggle('points')}
                  className={`py-1.5 px-2 border-2 border-black font-black text-[10px] uppercase tracking-wider transition-colors ${
                    formScale === 'points'
                      ? 'bg-yellow-300 text-black shadow-[1.5px_1.5px_0px_0px_#000000]'
                      : 'bg-white hover:bg-gray-100'
                  }`}
                >
                  100-Point Scale
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase mb-1">
                Scale Terminology
              </label>
              <input
                type="text"
                required
                value={formTerminology}
                onChange={(e) => setFormTerminology(e.target.value)}
                placeholder="e.g. Giggitys, Peter Points..."
                className="w-full bg-white border-2 border-black p-1.5 font-black focus:outline-none focus:bg-yellow-50 text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-black uppercase">Your Score</label>
                <span className="font-black text-xs bg-black text-white px-1.5 py-0.5 border border-black">
                  {formRating} {formTerminology || 'Points'}
                </span>
              </div>

              {formScale === 'stars' ? (
                <div className="flex items-center gap-1.5 bg-white border-2 border-black p-1.5 justify-center">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setFormRating(num)}
                      className="hover:scale-110 transition-transform"
                    >
                      <Star
                        size={22}
                        fill={num <= formRating ? '#F59E0B' : 'transparent'}
                        className="stroke-[2] text-black"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-white border-2 border-black p-2 flex flex-col gap-1.5">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={formRating}
                    onChange={(e) => setFormRating(Number(e.target.value))}
                    className="w-full cursor-pointer accent-pink-600 h-1.5 bg-gray-200 border border-black rounded-none appearance-none"
                  />
                  <div className="flex justify-between text-[8px] font-black">
                    <span>1 (Trash)</span>
                    <span>50 (Meh)</span>
                    <span>100 (Masterpiece)</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase mb-1">Comments</label>
              <textarea
                required
                rows={2}
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Give us your worst, Peter style..."
                className="w-full bg-white border-2 border-black p-1.5 font-black focus:outline-none focus:bg-yellow-50 text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-black text-white hover:bg-yellow-300 hover:text-black border-2 border-black p-2 text-xs font-black uppercase tracking-wider transition-colors shadow-[2px_2px_0px_0px_#FFFFFF] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
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
