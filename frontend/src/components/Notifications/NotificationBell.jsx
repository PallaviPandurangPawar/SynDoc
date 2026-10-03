// The bell button in the top bar. Clicking it opens a dropdown with
//   1. a box for the email of the person you want to message,
//   2. a box for your message (+ Send),
//   3. the notifications you received, newest first.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import {
  getNotifications,
  sendNotification,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearNotifications
} from '../../services/api';
import { timeAgo } from '../../lib/timeAgo';

const MAX_LENGTH = 500;

export default function NotificationBell() {
  const { socket } = useSocket();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', text }

  const wrapperRef = useRef(null);
  const messageRef = useRef(null);

  // Loads the saved notifications from the server
  const load = useCallback(async () => {
    try {
      const res = await getNotifications();
      setItems(res.data || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // keep showing what we already have
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // New notifications arrive instantly through the socket
  useEffect(() => {
    if (!socket) return undefined;

    const handleNew = (notification) => {
      setItems((prev) => [notification, ...prev.filter((n) => n.id !== notification.id)]);
      setUnreadCount((count) => count + 1);
    };

    socket.on('notification', handleNew);
    socket.on('connect', load); // after a dropped connection, catch up on anything missed

    return () => {
      socket.off('notification', handleNew);
      socket.off('connect', load);
    };
  }, [socket, load]);

  // Close the dropdown when clicking outside of it or pressing Esc
  useEffect(() => {
    if (!open) return undefined;

    const handleMouseDown = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      setFeedback(null);
      load();
    }
    setOpen((value) => !value);
  };

  // ----- Sending -----
  const handleSend = async () => {
    if (sending) return;
    const to = email.trim();
    const text = message.trim();
    if (!to || !text) {
      setFeedback({ type: 'error', text: 'Enter an email and a message.' });
      return;
    }

    setSending(true);
    setFeedback(null);
    try {
      const res = await sendNotification({ email: to, message: text });
      setFeedback({ type: 'success', text: res.message || 'Message sent.' });
      setMessage('');
    } catch (error) {
      const reason = error.response && error.response.data && error.response.data.message;
      setFeedback({ type: 'error', text: reason || 'Could not send the message.' });
    } finally {
      setSending(false);
    }
  };

  // ----- Reading / deleting -----
  const handleOpenItem = async (notification) => {
    if (notification.isRead) return;
    setItems((prev) => prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)));
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await markNotificationRead(notification.id);
    } catch {
      load();
    }
  };

  const handleDelete = async (notification) => {
    setItems((prev) => prev.filter((n) => n.id !== notification.id));
    if (!notification.isRead) setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await deleteNotification(notification.id);
    } catch {
      load();
    }
  };

  const handleMarkAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      load();
    }
  };

  const handleClear = async () => {
    setItems([]);
    setUnreadCount(0);
    try {
      await clearNotifications();
    } catch {
      load();
    }
  };

  // "Reply" fills in the sender's email and jumps to the message box
  const handleReply = (notification) => {
    if (!notification.sender) return;
    setEmail(notification.sender.email);
    setFeedback(null);
    setTimeout(() => { if (messageRef.current) messageRef.current.focus(); }, 0);
  };

  return (
    <div className="notif-wrapper" ref={wrapperRef} onClick={(e) => e.stopPropagation()}>
      <button
        className="nav-icon-btn notif-bell"
        aria-label="Notifications"
        aria-expanded={open}
        title="Notifications"
        onClick={toggle}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown" role="dialog" aria-label="Notifications">
          <div className="notif-compose">
            <h4 className="notif-title">Send a message</h4>
            <input
              type="email"
              className="notif-input"
              placeholder="Email of the person"
              aria-label="Email of the person"
              autoComplete="off"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFeedback(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (messageRef.current) messageRef.current.focus(); } }}
            />
            <textarea
              ref={messageRef}
              className="notif-input notif-textarea"
              rows={3}
              maxLength={MAX_LENGTH}
              placeholder="Type your message..."
              aria-label="Message"
              autoComplete="off"
              value={message}
              onChange={(e) => { setMessage(e.target.value); setFeedback(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <div className="notif-compose-footer">
              <span className="notif-count">{message.length}/{MAX_LENGTH}</span>
              <button
                className="notif-send"
                onClick={handleSend}
                disabled={sending || !email.trim() || !message.trim()}
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
            {feedback && <p className={`notif-feedback ${feedback.type}`}>{feedback.text}</p>}
          </div>

          <div className="notif-list-header">
            <h4 className="notif-title">
              Notifications{unreadCount > 0 ? ` (${unreadCount} new)` : ''}
            </h4>
            <div className="notif-list-actions">
              <button className="notif-link" onClick={handleMarkAll} disabled={unreadCount === 0}>Mark all read</button>
              <button className="notif-link danger" onClick={handleClear} disabled={items.length === 0}>Clear all</button>
            </div>
          </div>

          <div className="notif-list">
            {items.length === 0 ? (
              <p className="notif-empty">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`notif-item${n.isRead ? '' : ' unread'}`}
                  onClick={() => handleOpenItem(n)}
                >
                  <div className="notif-item-top">
                    <span className="notif-from">{n.sender ? n.sender.name : 'SyncDoc'}</span>
                    <span className="notif-time">{timeAgo(n.createdAt)}</span>
                  </div>
                  {n.sender && <div className="notif-email">{n.sender.email}</div>}
                  <p className="notif-text">{n.message}</p>
                  <div className="notif-item-actions">
                    {n.sender && (
                      <button className="notif-link" onClick={(e) => { e.stopPropagation(); handleReply(n); }}>Reply</button>
                    )}
                    <button className="notif-link danger" onClick={(e) => { e.stopPropagation(); handleDelete(n); }}>Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}