'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase, safeStorage } from '../utils/supabaseClient';

export interface SamvaadComment {
  id: string;
  poll_id: string;
  parent_id?: string | null;
  voter_token: string;
  username: string;
  pc_name: string;
  state_name: string;
  selected_option_id?: number | null;
  selected_option_text?: string | null;
  comment_text: string;
  upvotes: number;
  downvotes: number;
  net_karma: number;
  status: 'ACTIVE' | 'QUARANTINED' | 'DELETED';
  flag_count: number;
  is_pinned?: boolean;
  created_at: string;
}

interface SamvaadSectionProps {
  pollId: string;
  pollCategory?: string;
  lang?: 'EN' | 'HI';
  userSeat?: string;
  userState?: string;
  selectedOptionText?: string;
  selectedOptionId?: number | null;
  hasVoted?: boolean;
  isModal?: boolean;
  onClose?: () => void;
  onRequireAuth?: () => void;
  onUpdateMetrics?: (count: number, topComment: any | null) => void;
}

type SortFilter = 'TOP' | 'NEW' | 'OLD' | 'CHARCHIT';
type SpatialFilter = 'ALL' | 'STATE' | 'SEAT';

function formatRelativeTime(dateStr: string, lang: 'EN' | 'HI' = 'EN'): string {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return lang === 'HI' ? 'अभी' : 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}${lang === 'HI' ? 'मि' : 'm'}`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}${lang === 'HI' ? 'घं' : 'h'}`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}${lang === 'HI' ? 'दि' : 'd'}`;
}

export function SamvaadIcon({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </svg>
  );
}

export default function SamvaadSection({
  pollId,
  pollCategory = 'LokMat',
  lang = 'EN',
  userSeat = 'Constituency',
  userState = 'State',
  selectedOptionText,
  selectedOptionId,
  hasVoted = false,
  isModal = false,
  onClose,
  onRequireAuth,
  onUpdateMetrics
}: SamvaadSectionProps) {
  const [comments, setComments] = useState<SamvaadComment[]>([]);
  const [userReactions, setUserReactions] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<SamvaadComment | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [sortMode, setSortMode] = useState<SortFilter>('TOP');
  const [spatialMode, setSpatialMode] = useState<SpatialFilter>('ALL');
  const [collapsedTrees, setCollapsedTrees] = useState<Record<string, boolean>>({});
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [copiedCommentId, setCopiedCommentId] = useState<string | null>(null);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);

  const activeToken = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return safeStorage.getItem('bhumat_voter_token') || localStorage.getItem('bhumat_voter_token') || '';
  }, []);

  const activeUsername = useMemo(() => {
    if (typeof window === 'undefined') return 'Nagrik';
    const raw = safeStorage.getItem('bhumat_username') || localStorage.getItem('bhumat_username');
    if (raw && raw.trim()) return raw;
    return `Nagrik_${activeToken.slice(-4) || '543'}`;
  }, [activeToken]);

  const isVerifiedUser = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const phone = safeStorage.getItem('bhumat_user_phone') || localStorage.getItem('bhumat_user_phone');
    return Boolean(phone && phone.trim().length >= 10);
  }, []);

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('samvaad_comments')
        .select('*')
        .eq('poll_id', pollId)
        .in('status', ['ACTIVE', 'QUARANTINED', 'DELETED'])
        .order('created_at', { ascending: false });

      if (!error && data) {
        const commentList = data as SamvaadComment[];
        setComments(commentList);
        if (onUpdateMetrics) {
          const activeList = commentList.filter(c => c.status !== 'DELETED');
          const roots = activeList.filter((c) => !c.parent_id);
          const topComment = roots.sort((a, b) => (b.net_karma || 0) - (a.net_karma || 0))[0] || null;
          onUpdateMetrics(activeList.length, topComment);
        }
      }

      if (activeToken) {
        const { data: reactionsData } = await supabase
          .from('samvaad_reactions')
          .select('comment_id, reaction')
          .eq('voter_token', activeToken);

        if (reactionsData) {
          const map: Record<string, number> = {};
          reactionsData.forEach((r) => {
            map[r.comment_id] = r.reaction;
          });
          setUserReactions(map);
        }
      }
    } catch (e) {
      console.error('Failed to load Samvaad thread:', e);
    }
  };

  useEffect(() => {
    loadComments();
  }, [pollId, activeToken]);

  const handleReaction = async (commentId: string, delta: 1 | -1) => {
    if (!activeToken) {
      if (onRequireAuth) onRequireAuth();
      return;
    }
    const currentReaction = userReactions[commentId] || 0;
    const nextReaction = currentReaction === delta ? 0 : delta;
    setUserReactions((prev) => ({
      ...prev,
      [commentId]: nextReaction
    }));
    setComments((prev) =>
      prev.map((c) => {
        if (c.id !== commentId) return c;
        let karmaDelta = 0;
        if (currentReaction === delta) karmaDelta = -delta;
        else if (currentReaction === 0) karmaDelta = delta;
        else karmaDelta = 2 * delta;
        return { ...c, net_karma: c.net_karma + karmaDelta };
      })
    );
    try {
      await supabase.rpc('react_to_samvaad_comment', {
        p_comment_id: commentId,
        p_voter_token: activeToken,
        p_reaction: delta
      });
    } catch (e) {
      console.error('Reaction RPC failed:', e);
      loadComments();
    }
  };

  const handleSubmitComment = async (parentId: string | null = null) => {
    const textToSubmit = parentId ? replyText.trim() : inputText.trim();
    if (!textToSubmit) return;
    if (textToSubmit.length > 543) {
      alert(lang === 'HI' ? 'अधिकतम 543 अक्षर अनुमत हैं।' : 'Maximum 543 characters allowed.');
      return;
    }
    if (cooldownSeconds > 0) {
      alert(lang === 'HI' ? `कृपया ${cooldownSeconds}s प्रतीक्षा करें।` : `Please wait ${cooldownSeconds}s.`);
      return;
    }
    setIsSubmitting(true);
    try {
      const newCommentPayload = {
        poll_id: pollId,
        parent_id: parentId,
        voter_token: activeToken || 'guest_voter',
        username: activeUsername,
        pc_name: userSeat || 'Bharat',
        state_name: userState || 'Bharat',
        selected_option_id: selectedOptionId ?? null,
        selected_option_text: selectedOptionText || null,
        comment_text: textToSubmit,
        status: 'ACTIVE' as const,
        upvotes: 0,
        downvotes: 0,
        net_karma: 0,
        flag_count: 0
      };
      const { data, error } = await supabase
        .from('samvaad_comments')
        .insert(newCommentPayload)
        .select()
        .single();

      if (!error && data) {
        const created = data as SamvaadComment;
        const updatedList = [created, ...comments];
        setComments(updatedList);
        if (parentId) {
          setReplyingTo(null);
          setReplyText('');
        } else {
          setInputText('');
          setIsComposerOpen(false);
        }
        if (onUpdateMetrics) {
          const activeList = updatedList.filter(c => c.status !== 'DELETED');
          const roots = activeList.filter((c) => !c.parent_id);
          const topComment = roots.sort((a, b) => (b.net_karma || 0) - (a.net_karma || 0))[0] || null;
          onUpdateMetrics(activeList.length, topComment);
        }
        setCooldownSeconds(30);
        if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = setInterval(() => {
          setCooldownSeconds((prev) => {
            if (prev <= 1) {
              if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        alert('Failed to post: ' + error?.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm(lang === 'HI' ? 'क्या आप इस विचार को हटाना चाहते हैं?' : 'Delete this comment?')) return;
    try {
      const { error } = await supabase
        .from('samvaad_comments')
        .update({ status: 'DELETED', comment_text: '[Comment deleted by citizen]' })
        .eq('id', commentId)
        .eq('voter_token', activeToken);
      if (!error) {
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, status: 'DELETED', comment_text: '[Comment deleted by citizen]' } : c));
        loadComments();
      }
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  const handleShareComment = (commentId: string) => {
    const shareUrl = `${window.location.origin}/poll/${pollId}?comment=${commentId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedCommentId(commentId);
      setTimeout(() => setCopiedCommentId(null), 2000);
    }
  };

  const handleReport = async (commentId: string) => {
    if (reportedIds.has(commentId)) return;
    if (!confirm(lang === 'HI' ? 'क्या आप इस विचार को रिपोर्ट करना चाहते हैं?' : 'Report this perspective?')) return;
    setReportedIds((prev) => new Set(prev).add(commentId));
    try {
      await supabase.rpc('report_samvaad_comment', {
        p_comment_id: commentId,
        p_voter_token: activeToken || 'anon',
        p_reason: 'COMMUNITY_FLAG'
      });
      loadComments();
    } catch (e) {
      console.error('Report failed:', e);
    }
  };

  const { rootComments, replyMap } = useMemo(() => {
    const replies: Record<string, SamvaadComment[]> = {};
    const roots: SamvaadComment[] = [];
    comments.forEach((c) => {
      if (c.parent_id) {
        if (!replies[c.parent_id]) replies[c.parent_id] = [];
        replies[c.parent_id].push(c);
      } else {
        roots.push(c);
      }
    });
    Object.keys(replies).forEach((k) => {
      replies[k].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
    let filteredRoots = roots.filter((r) => {
      if (spatialMode === 'SEAT') {
        return r.pc_name?.toLowerCase().trim() === userSeat?.toLowerCase().trim();
      }
      if (spatialMode === 'STATE') {
        return r.state_name?.toLowerCase().trim() === userState?.toLowerCase().trim();
      }
      return true;
    });
    filteredRoots.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      if (sortMode === 'NEW') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortMode === 'OLD') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortMode === 'CHARCHIT') {
        const totalA = (a.upvotes || 0) + (a.downvotes || 0) + (replies[a.id]?.length || 0);
        const totalB = (b.upvotes || 0) + (b.downvotes || 0) + (replies[b.id]?.length || 0);
        return totalB - totalA;
      }
      return (b.net_karma || 0) - (a.net_karma || 0);
    });
    return { rootComments: filteredRoots, replyMap: replies };
  }, [comments, sortMode, spatialMode, userSeat, userState]);

  const activeCommentsCount = useMemo(() => {
    return comments.filter(c => c.status !== 'DELETED').length;
  }, [comments]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, boxSizing: 'border-box' }}>
      
      {/* 1. Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '12px',
        borderBottom: '1px solid #f1f5f9',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SamvaadIcon size={18} color="#0f172a" />
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
            {lang === 'HI' ? 'संवाद' : 'Samvaad'}
          </span>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: '#475569',
            backgroundColor: '#f1f5f9',
            padding: '2px 8px',
            borderRadius: '999px',
            border: '1px solid #e2e8f0'
          }}>
            {activeCommentsCount}
          </span>
        </div>
        {isModal && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px'
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* 2. Controls Row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 0',
        flexWrap: 'wrap',
        flexShrink: 0
      }}>
        <div style={{
          display: 'flex',
          backgroundColor: '#f1f5f9',
          padding: '2px',
          borderRadius: '8px',
          gap: '2px'
        }}>
          <button
            type="button"
            onClick={() => setSpatialMode('SEAT')}
            style={{
              padding: '4px 9px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: spatialMode === 'SEAT' ? '#ffffff' : 'transparent',
              color: spatialMode === 'SEAT' ? '#0f172a' : '#64748b',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: spatialMode === 'SEAT' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            📍 {userSeat || 'Seat'}
          </button>
          <button
            type="button"
            onClick={() => setSpatialMode('STATE')}
            style={{
              padding: '4px 9px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: spatialMode === 'STATE' ? '#ffffff' : 'transparent',
              color: spatialMode === 'STATE' ? '#0f172a' : '#64748b',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: spatialMode === 'STATE' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            🏛️ {userState || 'State'}
          </button>
          <button
            type="button"
            onClick={() => setSpatialMode('ALL')}
            style={{
              padding: '4px 9px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: spatialMode === 'ALL' ? '#ffffff' : 'transparent',
              color: spatialMode === 'ALL' ? '#0f172a' : '#64748b',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: spatialMode === 'ALL' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            🇮🇳 {lang === 'HI' ? 'भारत' : 'All Bharat'}
          </button>
        </div>

        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortFilter)}
          style={{
            padding: '4px 8px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            fontSize: '11px',
            fontWeight: 600,
            color: '#334155',
            cursor: 'pointer'
          }}
        >
          <option value="TOP">{lang === 'HI' ? 'शीर्ष' : 'Top'}</option>
          <option value="NEW">{lang === 'HI' ? 'नवीनतम' : 'New'}</option>
          <option value="OLD">{lang === 'HI' ? 'पुरातन' : 'Old'}</option>
          <option value="CHARCHIT">{lang === 'HI' ? 'चर्चित' : 'Hot'}</option>
        </select>
      </div>

      {/* 3. Fully Scrollable Thread Container */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        paddingRight: '4px',
        marginBottom: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: '12px' }}>
            {lang === 'HI' ? 'विचार लोड हो रहे हैं...' : 'Loading thoughts...'}
          </div>
        ) : rootComments.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '36px 16px',
            backgroundColor: '#f8fafc',
            borderRadius: '14px',
            border: '1px dashed #e2e8f0'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
              {lang === 'HI' ? 'इस फ़िल्टर में अभी कोई विचार नहीं है' : 'No thoughts yet'}
            </div>
            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
              {lang === 'HI' ? 'पहला विचार साझा करें।' : 'Be the first to share your perspective.'}
            </div>
          </div>
        ) : (
          rootComments.map((root) => {
            const replies = replyMap[root.id] || [];
            const isCollapsed = Boolean(collapsedTrees[root.id]);
            const myVote = userReactions[root.id] || 0;
            const isMyComment = activeToken && root.voter_token === activeToken;
            const isDeleted = root.status === 'DELETED';

            return (
              <div key={root.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{
                  backgroundColor: isDeleted ? '#f8fafc' : (root.is_pinned ? '#fffdf5' : '#ffffff'),
                  border: `1px solid ${root.is_pinned ? '#fde047' : '#e2e8f0'}`,
                  borderRadius: '12px',
                  padding: '10px 12px'
                }}>
                  {/* Author Line */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                        @{root.username}
                      </span>
                      <span style={{
                        fontSize: '9.5px',
                        color: '#475569',
                        backgroundColor: '#f1f5f9',
                        padding: '1px 5px',
                        borderRadius: '4px'
                      }}>
                        📍 {root.pc_name}
                      </span>
                      {root.selected_option_text && !isDeleted && (
                        <span style={{
                          fontSize: '9.5px',
                          color: '#059669',
                          backgroundColor: '#ecfdf5',
                          padding: '1px 5px',
                          borderRadius: '4px'
                        }}>
                          ✓ {root.selected_option_text.split('(')[0].trim()}
                        </span>
                      )}
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                        • {formatRelativeTime(root.created_at, lang)}
                      </span>
                    </div>
                    {!isDeleted && (
                      <button
                        type="button"
                        onClick={() => setCollapsedTrees((prev) => ({ ...prev, [root.id]: !isCollapsed }))}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer', padding: '0 2px' }}
                      >
                        {isCollapsed ? `+ (${replies.length})` : '—'}
                      </button>
                    )}
                  </div>

                  {!isCollapsed && (
                    <>
                      {/* Body */}
                      <div style={{
                        fontSize: '12.5px',
                        color: isDeleted ? '#94a3b8' : '#1e293b',
                        fontStyle: isDeleted ? 'italic' : 'normal',
                        lineHeight: 1.45,
                        margin: '4px 0 8px 0',
                        wordBreak: 'break-word'
                      }}>
                        {root.status === 'QUARANTINED' ? (
                          <span style={{ color: '#b45309', fontStyle: 'italic' }}>
                            [⚠️ {lang === 'HI' ? 'यह विचार समुदाय समीक्षाधीन है' : 'Under community review'}]
                          </span>
                        ) : (
                          root.comment_text
                        )}
                      </div>

                      {/* Interactive Bottom Bar with Thumbs Up/Down and Spacing */}
                      {!isDeleted && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Thumbs Up / Down Capsule */}
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              backgroundColor: '#f8fafc',
                              borderRadius: '8px',
                              padding: '2px 6px',
                              border: '1px solid #e2e8f0',
                              gap: '6px'
                            }}>
                              <button
                                type="button"
                                onClick={() => handleReaction(root.id, 1)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: myVote === 1 ? '#0284c7' : '#64748b',
                                  fontSize: '13px', padding: '2px 4px', lineHeight: 1
                                }}
                                title="Agree"
                              >
                                👍
                              </button>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: root.net_karma > 0 ? '#059669' : (root.net_karma < 0 ? '#dc2626' : '#64748b'),
                                minWidth: '16px',
                                textAlign: 'center'
                              }}>
                                {root.net_karma}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleReaction(root.id, -1)}
                                style={{
                                  background: 'none', border: 'none', cursor: 'pointer',
                                  color: myVote === -1 ? '#dc2626' : '#64748b',
                                  fontSize: '13px', padding: '2px 4px', lineHeight: 1
                                }}
                                title="Disagree"
                              >
                                👎
                              </button>
                            </div>

                            {/* Reply Trigger */}
                            {hasVoted && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!isVerifiedUser) {
                                    if (onRequireAuth) onRequireAuth();
                                    return;
                                  }
                                  setReplyingTo(replyingTo?.id === root.id ? null : root);
                                  setReplyText('');
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#64748b',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  padding: '4px 6px'
                                }}
                              >
                                ↩ {lang === 'HI' ? 'उत्तर' : 'Reply'} {replies.length > 0 && `(${replies.length})`}
                              </button>
                            )}

                            {/* Share Link Action */}
                            <button
                              type="button"
                              onClick={() => handleShareComment(root.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: copiedCommentId === root.id ? '#059669' : '#64748b',
                                fontSize: '11px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                padding: '4px 6px'
                              }}
                            >
                              {copiedCommentId === root.id ? '✓ Copied' : '🔗 Share'}
                            </button>

                            {/* Delete Self */}
                            {isMyComment && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(root.id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#94a3b8',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  padding: '4px 6px'
                                }}
                              >
                                {lang === 'HI' ? 'हटाएं' : 'Delete'}
                              </button>
                            )}
                          </div>

                          {/* Report Action */}
                          {!isMyComment && (
                            <button
                              type="button"
                              onClick={() => handleReport(root.id)}
                              title="Report"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: reportedIds.has(root.id) ? '#dc2626' : '#cbd5e1',
                                cursor: 'pointer',
                                fontSize: '12px',
                                padding: '2px'
                              }}
                            >
                              ⚑
                            </button>
                          )}
                        </div>
                      )}

                      {/* Inline Reply Composer */}
                      {replyingTo?.id === root.id && (
                        <div style={{
                          marginTop: '8px',
                          padding: '10px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1'
                        }}>
                          <div style={{ fontSize: '10.5px', color: '#64748b', marginBottom: '4px' }}>
                            {lang === 'HI' ? `@${root.username} को उत्तर:` : `Replying to @${root.username}:`}
                          </div>
                          <textarea
                            rows={2}
                            maxLength={543}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder={lang === 'HI' ? 'उत्तर लिखें...' : 'Write reply...'}
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              border: 'none',
                              outline: 'none',
                              resize: 'none',
                              backgroundColor: 'transparent',
                              fontSize: '12px',
                              fontFamily: 'inherit',
                              color: '#0f172a'
                            }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                            <button
                              type="button"
                              onClick={() => setReplyingTo(null)}
                              style={{ padding: '4px 8px', background: 'none', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer' }}
                            >
                              {lang === 'HI' ? 'रद्द' : 'Cancel'}
                            </button>
                            <button
                              type="button"
                              disabled={isSubmitting || !replyText.trim() || cooldownSeconds > 0}
                              onClick={() => handleSubmitComment(root.id)}
                              style={{
                                padding: '5px 12px',
                                backgroundColor: isSubmitting || !replyText.trim() || cooldownSeconds > 0 ? '#94a3b8' : '#0f172a',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              {isSubmitting ? '...' : (lang === 'HI' ? 'उत्तर' : 'Reply')}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Replies Thread */}
                {!isCollapsed && replies.length > 0 && (
                  <div style={{
                    marginLeft: '12px',
                    paddingLeft: '12px',
                    borderLeft: '1.5px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    {replies.map((reply) => {
                      const myReplyVote = userReactions[reply.id] || 0;
                      const isMyReply = activeToken && reply.voter_token === activeToken;
                      const isReplyDeleted = reply.status === 'DELETED';

                      return (
                        <div
                          key={reply.id}
                          style={{
                            backgroundColor: isReplyDeleted ? '#f8fafc' : '#ffffff',
                            border: '1px solid #f1f5f9',
                            borderRadius: '10px',
                            padding: '8px 10px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#0f172a' }}>
                                @{reply.username}
                              </span>
                              <span style={{ fontSize: '9px', color: '#64748b' }}>
                                • 📍 {reply.pc_name}
                              </span>
                              <span style={{ fontSize: '9px', color: '#94a3b8' }}>
                                • {formatRelativeTime(reply.created_at, lang)}
                              </span>
                            </div>

                            {!isReplyDeleted && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  backgroundColor: '#f8fafc',
                                  borderRadius: '6px',
                                  padding: '1px 4px',
                                  border: '1px solid #e2e8f0',
                                  gap: '4px'
                                }}>
                                  <button
                                    type="button"
                                    onClick={() => handleReaction(reply.id, 1)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', padding: 0 }}
                                  >
                                    👍
                                  </button>
                                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#0f172a', minWidth: '12px', textAlign: 'center' }}>
                                    {reply.net_karma}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleReaction(reply.id, -1)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', padding: 0 }}
                                  >
                                    👎
                                  </button>
                                </div>
                                {isMyReply && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(reply.id)}
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '10px', cursor: 'pointer', padding: 0 }}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <div style={{ fontSize: '11.5px', color: isReplyDeleted ? '#94a3b8' : '#334155', fontStyle: isReplyDeleted ? 'italic' : 'normal', lineHeight: 1.4, wordBreak: 'break-word' }}>
                            {reply.comment_text}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 4. Bottom Sticky Action / Composer */}
      <div style={{
        paddingTop: '8px',
        borderTop: '1px solid #f1f5f9',
        backgroundColor: '#ffffff',
        flexShrink: 0
      }}>
        {!hasVoted ? (
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '8px 12px',
            textAlign: 'center',
            fontSize: '11px',
            color: '#64748b'
          }}>
            🔒 {lang === 'HI' ? 'विचार साझा करने हेतु पहले अपना मत दर्ज करें।' : 'Cast your ballot above to unlock Samvaad.'}
          </div>
        ) : !isVerifiedUser ? (
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#0f172a' }}>
                🔒 {lang === 'HI' ? 'मोबाइल सत्यापन आवश्यक' : 'Mobile Verification Required'}
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                {lang === 'HI' ? 'केवल OTP सत्यापित नागरिक ही टिप्पणी या उत्तर दे सकते हैं।' : 'Only mobile OTP verified users can comment or reply.'}
              </div>
            </div>
            <button
              type="button"
              onClick={onRequireAuth}
              style={{
                padding: '6px 14px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {lang === 'HI' ? 'सत्यापित करें' : 'Verify Mobile'}
            </button>
          </div>
        ) : isComposerOpen ? (
          <div style={{
            backgroundColor: '#ffffff',
            border: '1.5px solid #cbd5e1',
            borderRadius: '10px',
            padding: '8px 10px'
          }}>
            <textarea
              ref={composerInputRef}
              rows={3}
              maxLength={543}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={lang === 'HI' ? 'अपना विचार लिखें (अधिकतम 543 अक्षर)...' : 'Share your perspective (543 chars max)...'}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: 'none',
                outline: 'none',
                resize: 'none',
                fontSize: '12px',
                fontFamily: 'inherit',
                lineHeight: 1.4,
                color: '#0f172a'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                {inputText.length} / 543
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setIsComposerOpen(false)}
                  style={{ padding: '4px 8px', background: 'none', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer' }}
                >
                  {lang === 'HI' ? 'रद्द' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || !inputText.trim() || cooldownSeconds > 0}
                  onClick={() => handleSubmitComment(null)}
                  style={{
                    padding: '5px 12px',
                    backgroundColor: isSubmitting || !inputText.trim() || cooldownSeconds > 0 ? '#94a3b8' : '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {cooldownSeconds > 0 ? `${cooldownSeconds}s` : (isSubmitting ? '...' : (lang === 'HI' ? 'प्रकाशित करें' : 'Post'))}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setIsComposerOpen(true);
              setTimeout(() => composerInputRef.current?.focus(), 100);
            }}
            style={{
              width: '100%',
              padding: '9px 12px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#64748b',
              fontSize: '11.5px',
              cursor: 'pointer'
            }}
          >
            <span>{lang === 'HI' ? 'अपना विचार साझा करें...' : 'Add your voice to this discussion...'}</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#0f172a' }}>
              {lang === 'HI' ? 'लिखें ❯' : 'Post ❯'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}