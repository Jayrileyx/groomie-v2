import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Messages() {
  const { token, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false); // mobile: toggle list vs chat
  const bottomRef = useRef(null);
  const pollRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    const res = await axios.get('/api/messages', { headers: { Authorization: `Bearer ${token}` } });
    setConversations(res.data);
    return res.data;
  }, [token]);

  const fetchMessages = useCallback(async (convoId) => {
    const res = await axios.get(`/api/messages/${convoId}`, { headers: { Authorization: `Bearer ${token}` } });
    setMessages(res.data);
    setConversations(prev => prev.map(c => c._id === convoId ? { ...c, unread: 0 } : c));
  }, [token]);

  const withId = searchParams.get('with');
  const bookingId = searchParams.get('booking');

  useEffect(() => {
    fetchConversations().then(convos => {
      setLoading(false);
      if (!withId && convos.length > 0) {
        setActiveConvo(convos[0]);
        fetchMessages(convos[0]._id);
      }
    });
  }, []);

  useEffect(() => {
    if (!withId) return;
    axios.post('/api/messages/start',
      { recipientId: withId, bookingId: bookingId || undefined },
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(res => {
      const convo = res.data;
      setActiveConvo(convo);
      fetchMessages(convo._id);
      setConversations(prev => prev.some(c => c._id === convo._id) ? prev : [convo, ...prev]);
      setLoading(false);
      setShowChat(true); // jump straight to chat on mobile
    }).catch(() => setLoading(false));
  }, [withId]);

  useEffect(() => {
    if (!activeConvo) return;
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      fetchMessages(activeConvo._id);
      fetchConversations();
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [activeConvo?._id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConversation = (convo) => {
    setActiveConvo(convo);
    fetchMessages(convo._id);
    setNewMessage('');
    setShowChat(true); // mobile: switch to chat view
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConvo) return;
    setSending(true);
    try {
      const res = await axios.post(`/api/messages/${activeConvo._id}`,
        { content: newMessage.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(prev => [...prev, res.data]);
      setNewMessage('');
      setConversations(prev => prev.map(c =>
        c._id === activeConvo._id
          ? { ...c, lastMessage: newMessage.trim(), lastMessageAt: new Date() }
          : c
      ));
    } catch {}
    setSending(false);
  };

  const getOtherParticipant = (convo) =>
    convo.participants?.find(p => String(p._id) !== String(user?.id || user?._id)) || {};

  const timeLabel = (dateStr) => {
    const d = new Date(dateStr);
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) return <p className="text-center mt-10 text-gray-400">Loading messages...</p>;

  const ConversationList = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h2 className="font-bold text-purple-600 text-lg">Messages</h2>
      </div>
      {conversations.length === 0 ? (
        <p className="text-gray-400 text-sm text-center mt-8 px-4">No conversations yet.</p>
      ) : (
        <div className="overflow-y-auto flex-1">
          {conversations.map(c => {
            const other = getOtherParticipant(c);
            const isActive = activeConvo?._id === c._id;
            return (
              <div
                key={c._id}
                onClick={() => openConversation(c)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b hover:bg-purple-50 transition ${isActive ? 'bg-purple-50' : ''}`}
              >
                {other.avatar ? (
                  <img src={other.avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-0.5" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-500 font-bold flex-shrink-0 mt-0.5">
                    {(other.firstName?.[0] || '?').toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-sm truncate">{other.firstName} {other.lastName}</p>
                    <p className="text-xs text-gray-400 flex-shrink-0 ml-1">{timeLabel(c.lastMessageAt)}</p>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{c.lastMessage || 'Start the conversation'}</p>
                </div>
                {c.unread > 0 && (
                  <span className="bg-purple-500 text-white text-xs rounded-full px-2 py-0.5 font-bold flex-shrink-0 self-center">
                    {c.unread}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const ChatArea = () => {
    const other = activeConvo ? getOtherParticipant(activeConvo) : null;
    return (
      <div className="flex flex-col h-full">
        {!activeConvo ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select a conversation to start messaging
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-3">
              {/* Back button — mobile only */}
              <button
                onClick={() => setShowChat(false)}
                className="sm:hidden text-purple-500 font-bold text-lg mr-1 leading-none"
                aria-label="Back to conversations"
              >
                ←
              </button>
              {other?.avatar ? (
                <img src={other.avatar} alt="avatar" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-500 font-bold text-sm">
                  {(other?.firstName?.[0] || '?').toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-sm">{other?.firstName} {other?.lastName}</p>
                <p className="text-xs text-gray-400 capitalize">{other?.role}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
              {messages.length === 0 && (
                <p className="text-center text-gray-400 text-sm mt-8">No messages yet. Say hello!</p>
              )}
              {messages.map(m => {
                const isMe = String(m.sender?._id || m.sender) === String(user?.id || user?._id);
                return (
                  <div key={m._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] sm:max-w-md px-4 py-2 rounded-2xl text-sm ${
                      isMe
                        ? 'bg-purple-500 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}>
                      <p>{m.content}</p>
                      <p className={`text-xs mt-1 ${isMe ? 'text-purple-200' : 'text-gray-400'}`}>
                        {timeLabel(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="px-4 py-3 border-t flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="bg-purple-500 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-purple-600 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile: toggle between list and chat */}
      <div className="sm:hidden border rounded-xl overflow-hidden bg-white" style={{ height: 'calc(100vh - 100px)' }}>
        {!showChat ? <ConversationList /> : <ChatArea />}
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden sm:flex h-[calc(100vh-80px)] border rounded-xl overflow-hidden bg-white">
        <div className="w-80 border-r flex flex-col flex-shrink-0">
          <ConversationList />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <ChatArea />
        </div>
      </div>
    </>
  );
}
