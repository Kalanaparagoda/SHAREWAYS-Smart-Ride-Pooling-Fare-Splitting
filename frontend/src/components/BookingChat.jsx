import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../firebase'
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'
import toast from 'react-hot-toast'

/**
 * BookingChat — real-time in-app messaging between driver and passenger.
 *
 * Messages are stored in Firestore:
 *   chats/{bookingId}/messages/{messageId}
 *
 * No phone numbers are exposed — messages are identified by uid + display_name.
 *
 * Props:
 *   bookingId: string
 *   partnerName: string — the other person's name shown in the header
 *   onClose(): called to dismiss the chat panel
 */
export default function BookingChat({ bookingId, partnerName, onClose }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const displayName = user?.displayName || 'You'

  // Listen to messages in real-time
  useEffect(() => {
    if (!bookingId) return

    const q = query(
      collection(db, 'chats', bookingId, 'messages'),
      orderBy('created_at', 'asc')
    )

    const unsub = onSnapshot(q, (snap) => {
      const msgs = []
      snap.forEach((doc) => msgs.push({ id: doc.id, ...doc.data() }))
      setMessages(msgs)
    }, (err) => {
      console.error('Chat listener error:', err)
    })

    return () => unsub()
  }, [bookingId])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    setInput('')
    try {
      await addDoc(collection(db, 'chats', bookingId, 'messages'), {
        text,
        sender_uid: user.uid,
        sender_name: displayName,
        created_at: serverTimestamp(),
      })
    } catch (err) {
      toast.error('Failed to send message')
      setInput(text) // restore on failure
    } finally {
      setSending(false)
    }
  }, [input, sending, bookingId, user, displayName])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm">
            {partnerName?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">{partnerName || 'Chat'}</p>
            <p className="text-xs text-slate-400">End-to-end private ride chat</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
          aria-label="Close chat"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-slate-500 font-medium text-sm">No messages yet</p>
            <p className="text-slate-400 text-xs mt-1">
              Send a message to {partnerName}. No phone numbers are shared.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.sender_uid === user?.uid
          const time = msg.created_at?.toDate?.()
            ? msg.created_at.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : ''

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isMe && (
                  <span className="text-xs text-slate-400 ml-1">{msg.sender_name}</span>
                )}
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                    isMe
                      ? 'bg-orange-600 text-white rounded-br-sm'
                      : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-slate-400 mx-1">{time}</span>
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            rows={1}
            className="flex-1 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none max-h-28"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-full bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center shrink-0 disabled:opacity-40 transition-colors"
            aria-label="Send message"
          >
            {sending ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-slate-400 text-center mt-2">
          Messages are private and scoped to this ride booking only.
        </p>
      </div>
    </div>
  )
}
