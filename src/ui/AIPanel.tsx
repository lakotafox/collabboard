import React, { useState, useRef, useEffect } from 'react'
import { useUIStore } from '../store/uiStore'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function AIPanel() {
  const showAIPanel = useUIStore((s) => s.showAIPanel)
  const toggleAIPanel = useUIStore((s) => s.toggleAIPanel)
  const boardId = useUIStore((s) => s.boardId)
  const userId = useUIStore((s) => s.userId)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!showAIPanel) return null

  const handleSend = async () => {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          boardId,
          userId,
        }),
      })

      const data = await res.json()
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message || 'Done!' }])
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error processing command.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <span>AI Assistant</span>
        <button
          onClick={toggleAIPanel}
          style={{ background: 'none', border: 'none', color: '#cdd6f4', cursor: 'pointer', fontSize: 16 }}
        >
          ✕
        </button>
      </div>
      <div className="ai-messages">
        {messages.length === 0 && (
          <div style={{ color: '#6c7086', fontSize: 13, textAlign: 'center', padding: 20 }}>
            Try: "Create a SWOT analysis" or "Add a yellow sticky note"
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`ai-message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="ai-message assistant" style={{ opacity: 0.6 }}>
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="ai-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask AI to manipulate the board..."
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading}>
          Send
        </button>
      </div>
    </div>
  )
}
