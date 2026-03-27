import { useState, useRef, useEffect } from "react"
import { useTransformer } from "./useTransformer"
import { Analytics } from "@vercel/analytics/react"

const PALETTE = [
  { bg: "#2d1b69", border: "#7c3aed", text: "#c4b5fd", hex: "#7c3aed" },
  { bg: "#1e3a5f", border: "#3b82f6", text: "#93c5fd", hex: "#3b82f6" },
  { bg: "#134e4a", border: "#14b8a6", text: "#99f6e4", hex: "#14b8a6" },
  { bg: "#831843", border: "#ec4899", text: "#fbcfe8", hex: "#ec4899" },
  { bg: "#78350f", border: "#f59e0b", text: "#fde68a", hex: "#f59e0b" },
  { bg: "#14532d", border: "#22c55e", text: "#bbf7d0", hex: "#22c55e" },
  { bg: "#1e1b4b", border: "#818cf8", text: "#c7d2fe", hex: "#818cf8" },
  { bg: "#4c0519", border: "#f43f5e", text: "#fecdd3", hex: "#f43f5e" },
]

const EXAMPLES = [
  "The cat sat on the mat",
  "The capital of France is",
  "She opened the door and",
  "Once upon a time there",
]

const CONCEPTS = {
  tokens: {
    color: "#7c3aed",
    title: "What is a token?",
    body: "AI does not read letter by letter. It reads tokens — chunks that are usually a whole word, but long words split into pieces. 'unhappy' becomes ['un','happy']. GPT-2 has 50,257 possible tokens."
  },
  attention: {
    color: "#3b82f6",
    title: "What is attention? (real math)",
    body: "Attention(Q,K,V) = softmax(QK^T / sqrt(d_k)) * V. Every token creates a Query (what am I looking for?), a Key (what do I contain?), and a Value (what do I give?). The arcs you see ARE these softmax scores — averaged across all attention heads."
  },
  embeddings: {
    color: "#14b8a6",
    title: "What is an embedding?",
    body: "Each token is mapped to a 768-dimensional vector. Words with similar meanings cluster close together in this space. 'cat' and 'kitten' are nearby. 'cat' and 'democracy' are far apart."
  },
  output: {
    color: "#f59e0b",
    title: "What is softmax prediction?",
    body: "After all layers, the model produces logits — raw scores for all 50,257 vocabulary tokens. softmax converts these to probabilities summing to 100%. The highest probability word is the next-token prediction."
  }
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener("resize", fn)
    return () => window.removeEventListener("resize", fn)
  }, [])
  return isMobile
}

function AttentionCanvas({ tokens, weights, selectedToken, onSelect }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const prevRef = useRef(null)
  const currRef = useRef(null)
  const progRef = useRef(1)

  useEffect(() => {
    if (!weights || !weights.length) return
    prevRef.current = currRef.current
    currRef.current = weights
    progRef.current = 0
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const animate = () => {
      progRef.current = Math.min(progRef.current + 0.05, 1)
      draw()
      if (progRef.current < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [weights, selectedToken])

  function draw() {
    const canvas = canvasRef.current
    if (!canvas || !tokens.length) return
    const ctx = canvas.getContext("2d")
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)
    const PAD = 40
    const NODE_Y = 55
    const spacing = tokens.length > 1 ? (W - PAD * 2) / (tokens.length - 1) : 0
    const positions = tokens.map((_, i) => tokens.length === 1 ? W / 2 : PAD + i * spacing)
    const MAX_CURVE = H - NODE_Y - 25
    const t = progRef.current

    if (selectedToken !== null && currRef.current?.[selectedToken]) {
      const curr = currRef.current[selectedToken]
      const prev = prevRef.current?.[selectedToken] || curr
      const lerped = curr.map((c, i) => (prev[i] || 0) + (c - (prev[i] || 0)) * t)
      lerped.forEach((w, j) => {
        if (w < 0.04 || j === selectedToken) return
        const x1 = positions[selectedToken]
        const x2 = positions[j]
        const mx = (x1 + x2) / 2
        const curve = Math.min(Math.abs(x1 - x2) * 0.35 + 20, MAX_CURVE)
        const col = PALETTE[selectedToken % PALETTE.length].hex
        ctx.beginPath()
        ctx.moveTo(x1, NODE_Y)
        ctx.quadraticCurveTo(mx, NODE_Y + curve, x2, NODE_Y)
        ctx.strokeStyle = col
        ctx.lineWidth = Math.max(w * 14, 1.5)
        ctx.globalAlpha = Math.min(w * 1.1, 0.88) * t
        ctx.lineCap = "round"
        ctx.stroke()
        ctx.globalAlpha = 1
        if (w > 0.2 && curve > 20) {
          ctx.fillStyle = col
          ctx.font = "bold 10px monospace"
          ctx.textAlign = "center"
          ctx.globalAlpha = t * 0.85
          ctx.fillText((w * 100).toFixed(0) + "%", mx, NODE_Y + curve * 0.5)
          ctx.globalAlpha = 1
        }
      })
    }

    tokens.forEach((token, i) => {
      const x = positions[i]
      const c = PALETTE[i % PALETTE.length]
      const isSel = i === selectedToken
      const r = isSel ? 22 : 17
      if (isSel) {
        ctx.beginPath(); ctx.arc(x, NODE_Y, r + 10, 0, Math.PI * 2)
        ctx.fillStyle = c.hex + "18"; ctx.fill()
        ctx.beginPath(); ctx.arc(x, NODE_Y, r + 5, 0, Math.PI * 2)
        ctx.fillStyle = c.hex + "30"; ctx.fill()
      }
      ctx.beginPath(); ctx.arc(x, NODE_Y, r, 0, Math.PI * 2)
      ctx.fillStyle = c.bg; ctx.fill()
      ctx.strokeStyle = isSel ? "#fff" : c.border
      ctx.lineWidth = isSel ? 2.5 : 1.5; ctx.stroke()
      const fs = Math.min(12, Math.max(7, 60 / Math.max(token.length, 1)))
      ctx.fillStyle = "#fff"
      ctx.font = `${isSel ? "bold " : ""}${fs}px monospace`
      ctx.textAlign = "center"; ctx.textBaseline = "middle"
      ctx.fillText(token.length > 6 ? token.slice(0, 5) + "…" : token, x, NODE_Y)
      ctx.fillStyle = c.border; ctx.font = "9px monospace"
      ctx.textBaseline = "top"
      ctx.fillText("#" + i, x, NODE_Y + r + 4)
    })
  }

  function handleClick(e) {
    const canvas = canvasRef.current
    if (!canvas || !tokens.length) return
    const rect = canvas.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width)
    const my = (e.clientY - rect.top) * (canvas.height / rect.height)
    const PAD = 40
    const NODE_Y = 55
    const spacing = tokens.length > 1 ? (canvas.width - PAD * 2) / (tokens.length - 1) : 0
    for (let i = 0; i < tokens.length; i++) {
      const x = tokens.length === 1 ? canvas.width / 2 : PAD + i * spacing
      if (Math.sqrt((mx - x) ** 2 + (my - NODE_Y) ** 2) < 30) {
        onSelect(i === selectedToken ? null : i); return
      }
    }
  }

  return (
    <canvas ref={canvasRef} width={700} height={180} onClick={handleClick}
      style={{ width: "100%", borderRadius: 10, background: "#060b14", cursor: "pointer", border: "1px solid #0f172a", display: "block" }}
    />
  )
}

function EmbeddingHeatmap({ tokens, embeddings }) {
  const [hovered, setHovered] = useState(null)
  const isMobile = useIsMobile()
  if (!embeddings.length) return null
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#64748b" }}>Scale:</span>
        {[0.2, 0.5, 0.8].map((v, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: "#7c3aed", opacity: v }} />
            <span style={{ fontSize: 11, color: "#64748b" }}>{v.toFixed(1)}</span>
          </div>
        ))}
      </div>
      {tokens.map((token, i) => {
        const c = PALETTE[i % PALETTE.length]
        const vals = embeddings[i] || []
        const displayVals = isMobile ? vals.slice(0, 16) : vals
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, animation: `fadeSlideIn 0.3s ease ${i * 0.05}s both` }}>
            <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, width: isMobile ? 60 : 86, flexShrink: 0, color: c.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {token}
            </div>
            <div style={{ fontSize: 11, color: "#334155", flexShrink: 0 }}>→</div>
            <div style={{ display: "flex", gap: 2, flexWrap: "wrap", flex: 1 }}>
              {displayVals.map((v, k) => {
                const key = i + "-" + k
                const isHov = hovered === key
                return (
                  <div key={k} onMouseEnter={() => setHovered(key)} onMouseLeave={() => setHovered(null)}
                    title={`dim ${k}: ${v.toFixed(4)}`}
                    style={{ width: 15, height: 15, borderRadius: 3, background: c.hex, opacity: v * 0.85 + 0.15, cursor: "crosshair", transform: isHov ? "scale(1.8)" : "scale(1)", transition: "transform 0.12s", position: "relative", zIndex: isHov ? 20 : 1 }}
                  />
                )
              })}
            </div>
            <div style={{ fontSize: 10, color: "#334155", whiteSpace: "nowrap", flexShrink: 0 }}>768d</div>
          </div>
        )
      })}
    </div>
  )
}

function ProbBars({ probs }) {
  return (
    <div>
      {probs.map((item, i) => {
        const c = PALETTE[i % PALETTE.length]
        const pct = item.prob * 100
        return (
          <div key={item.word + i} style={{ marginBottom: 12, animation: `fadeSlideIn 0.4s ease ${i * 0.06}s both` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {i === 0 && <span style={{ fontSize: 10, background: c.hex + "33", color: c.text, border: "1px solid " + c.border, borderRadius: 4, padding: "1px 6px", fontFamily: "monospace" }}>top</span>}
                <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: c.text }}>{item.word}</span>
              </div>
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>{pct.toFixed(1)}%</span>
            </div>
            <div style={{ height: 8, background: "#0f172a", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: Math.max(pct, 1.5) + "%", background: c.hex, borderRadius: 99, transition: "width 0.8s cubic-bezier(0.34,1.2,0.64,1)", boxShadow: "0 0 8px " + c.hex + "55" }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ConceptCard({ tab }) {
  const [open, setOpen] = useState(false)
  const c = CONCEPTS[tab]
  if (!c) return null
  return (
    <div style={{ marginTop: 18, borderRadius: 10, overflow: "hidden", border: "1px solid " + c.color + "44" }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: "100%", background: c.color + "15", border: "none", padding: "11px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", color: c.color }}>
        <span style={{ fontSize: 13, fontWeight: 600, textAlign: "left" }}>{c.title}</span>
        <span style={{ fontSize: 14, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none", flexShrink: 0, marginLeft: 8 }}>▾</span>
      </button>
      {open && (
        <div style={{ background: "#060b14", padding: "14px 16px", fontSize: 13, color: "#94a3b8", lineHeight: 1.8, animation: "fadeSlideIn 0.2s ease" }}>
          {c.body}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status, progress }) {
  const map = {
    idle:    { color: "#64748b", label: "● idle" },
    loading: { color: "#f59e0b", label: "● " + progress + "%" },
    running: { color: "#a78bfa", label: "● thinking" },
    ready:   { color: "#22c55e", label: "● ready" },
    error:   { color: "#ef4444", label: "● error" },
  }
  const s = map[status] || map.idle
  return <span style={{ fontSize: 12, fontFamily: "monospace", color: s.color }}>{s.label}</span>
}

function StepIndicator({ current }) {
  const isMobile = useIsMobile()
  const steps = [
    { id: "tokens", label: isMobile ? "Tok" : "Tokenize" },
    { id: "attention", label: isMobile ? "Attn" : "Attend" },
    { id: "embeddings", label: isMobile ? "Emb" : "Embed" },
    { id: "output", label: isMobile ? "Out" : "Predict" },
  ]
  const idx = steps.findIndex(s => s.id === current)
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
      {steps.map((s, i) => {
        const done = i < idx
        const active = i === idx
        const c = PALETTE[i % PALETTE.length]
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{ width: isMobile ? 22 : 26, height: isMobile ? 22 : 26, borderRadius: "50%", background: active ? c.hex : done ? c.hex + "55" : "#0f172a", border: "2px solid " + (active ? c.hex : done ? c.hex + "77" : "#1e293b"), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "monospace", color: active || done ? "#fff" : "#64748b", transition: "all 0.3s", boxShadow: active ? "0 0 10px " + c.hex + "66" : "none" }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: 9, color: active ? c.text : "#64748b", fontWeight: active ? 600 : 400, whiteSpace: "nowrap" }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 2, marginBottom: 16, background: done ? "#334155" : "#0f172a", transition: "background 0.3s" }} />}
          </div>
        )
      })}
    </div>
  )
}

export default function App() {
  const [sentence, setSentence] = useState("")
  const [selectedToken, setSelectedToken] = useState(null)
  const [layer, setLayer] = useState(0)
  const [tab, setTab] = useState("tokens")
  const [tabVisible, setTabVisible] = useState(true)
  const debounceRef = useRef(null)
  const isMobile = useIsMobile()

  const { status, progress, modelName, tokens, attention, embeddings, localProbs, groqProbs, groqStatus, error, run, loadModel } = useTransformer()

  useEffect(() => { loadModel() }, [loadModel])

  function handleInput(e) {
    const val = e.target.value
    setSentence(val)
    setSelectedToken(null)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => run(val), 1200)
  }

  function handleTokenClick(i) {
    setSelectedToken(prev => prev === i ? null : i)
    switchTab("attention")
  }

  function switchTab(id) {
    if (id === tab) return
    setTabVisible(false)
    setTimeout(() => { setTab(id); setTabVisible(true) }, 160)
  }

  const currentAttention = attention[layer] || []
  const TABS = [
    { id: "tokens",     num: "01", label: "Tokens",     color: "#7c3aed" },
    { id: "attention",  num: "02", label: "Attention",  color: "#3b82f6" },
    { id: "embeddings", num: "03", label: "Embed",      color: "#14b8a6" },
    { id: "output",     num: "04", label: "Output",     color: "#f59e0b" },
  ]

  const pad = isMobile ? "16px 14px" : "32px 20px"
  const panelPad = isMobile ? "16px" : "24px"

  return (
    <div style={{ minHeight: "100vh", background: "#020817", color: "#f1f5f9", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        @keyframes fadeSlideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        *{box-sizing:border-box;margin:0;padding:0}
        input,button{font-family:inherit}
        input::placeholder{color:#334155}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:#0f172a}
        ::-webkit-scrollbar-thumb{background:#334155;border-radius:2px}
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #0f172a", padding: isMobile ? "12px 16px" : "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#020817", position: "sticky", top: 0, zIndex: 100 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, background: "linear-gradient(135deg,#a78bfa,#38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 1 }}>
            Transformer Visualizer
          </h1>
          {!isMobile && <p style={{ fontSize: 12, color: "#64748b" }}>See inside an AI — live, free</p>}
        </div>
        <div style={{ textAlign: "right" }}>
          <StatusBadge status={status} progress={progress} />
          {modelName && <div style={{ fontSize: 10, color: "#475569", marginTop: 2, fontFamily: "monospace" }}>{modelName}</div>}
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: pad }}>

        {/* Hero */}
        {!tokens.length && status !== "loading" && (
          <div style={{ textAlign: "center", marginBottom: 28, animation: "fadeIn 0.5s ease" }}>
            <h2 style={{ fontSize: isMobile ? 22 : 30, fontWeight: 800, color: "#f1f5f9", marginBottom: 10, letterSpacing: "-0.5px" }}>
              How does AI understand language?
            </h2>
            <p style={{ fontSize: isMobile ? 14 : 15, color: "#94a3b8", maxWidth: 500, margin: "0 auto", lineHeight: 1.7 }}>
              Type any sentence. See every step a transformer takes. No ML background needed.
            </p>
          </div>
        )}

        {/* Input */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ position: "relative" }}>
            <input
              value={sentence} onChange={handleInput}
              placeholder={isMobile ? "Type a sentence…" : "Type a sentence — e.g. The cat sat on the mat"}
              maxLength={80}
              style={{ width: "100%", background: "#0a1628", border: "1px solid #1e293b", borderRadius: 12, padding: isMobile ? "14px 60px 14px 14px" : "16px 100px 16px 20px", color: "#f1f5f9", fontSize: isMobile ? 15 : 16, transition: "border-color .2s, box-shadow .2s" }}
              onFocus={e => { e.target.style.borderColor = "#7c3aed"; e.target.style.boxShadow = "0 0 0 3px #7c3aed22" }}
              onBlur={e => { e.target.style.borderColor = "#1e293b"; e.target.style.boxShadow = "none" }}
            />
            <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#334155", fontFamily: "monospace" }}>
              {sentence.length}/80
            </div>
          </div>
          {tokens.length > 0 && (
            <p style={{ margin: "6px 0 0 4px", fontSize: 12, color: "#64748b" }}>
              {tokens.length} token{tokens.length !== 1 ? "s" : ""} · click any token to explore attention
            </p>
          )}
          {error && (
            <div style={{ marginTop: 8, padding: "10px 14px", background: "#1a0505", border: "1px solid #7f1d1d", borderRadius: 8, fontSize: 12, color: "#fca5a5" }}>
              {error}
            </div>
          )}
        </div>

        {/* Loading bar */}
        {status === "loading" && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ height: 3, background: "#0f172a", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: progress + "%", background: "linear-gradient(90deg,#7c3aed,#38bdf8)", borderRadius: 99, transition: "width 0.4s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <p style={{ fontSize: 12, color: "#64748b" }}>Downloading model — cached after first load</p>
              <p style={{ fontSize: 12, color: "#7c3aed", fontFamily: "monospace" }}>{progress}%</p>
            </div>
          </div>
        )}

        {/* Examples */}
        {!tokens.length && status !== "loading" && (
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Try an example</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => { setSentence(ex); run(ex) }}
                  style={{ background: "#0a1628", border: "1px solid #1e293b", borderRadius: 8, padding: isMobile ? "7px 12px" : "8px 14px", color: "#94a3b8", fontSize: isMobile ? 12 : 13, cursor: "pointer", transition: "all .2s", fontFamily: "monospace" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#7c3aed"; e.currentTarget.style.color = "#a78bfa" }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e293b"; e.currentTarget.style.color = "#94a3b8" }}
                >
                  {isMobile ? ex.slice(0, 20) + "…" : ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* How it works cards */}
        {!tokens.length && status !== "loading" && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { step: 1, label: "Tokenize", desc: "Split text into pieces", color: "#7c3aed" },
              { step: 2, label: "Attend",   desc: "Find relationships", color: "#3b82f6" },
              { step: 3, label: "Embed",    desc: "Convert to numbers", color: "#14b8a6" },
              { step: 4, label: "Predict",  desc: "Output next word", color: "#f59e0b" },
            ].map((s, i) => (
              <div key={i} style={{ background: "#0a1628", border: "1px solid #0f172a", borderRadius: 12, padding: isMobile ? 12 : 16, animation: `fadeSlideIn 0.4s ease ${i * 0.08}s both` }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: s.color + "22", border: "1px solid " + s.color + "55", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: s.color, marginBottom: 8, fontFamily: "monospace" }}>
                  {s.step}
                </div>
                <p style={{ fontSize: isMobile ? 12 : 13, fontWeight: 600, color: "#94a3b8", marginBottom: 3 }}>{s.label}</p>
                <p style={{ fontSize: isMobile ? 11 : 12, color: "#64748b" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* Main visualizer */}
        {tokens.length > 0 && (
          <div style={{ animation: "fadeIn 0.3s ease" }}>
            <StepIndicator current={tab} />

            {/* Tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => switchTab(t.id)}
                  style={{ padding: isMobile ? "7px 12px" : "9px 18px", borderRadius: 9, border: "1px solid", cursor: "pointer", fontSize: isMobile ? 12 : 13, fontWeight: 500, transition: "all .2s", background: tab === t.id ? t.color : "#0a1628", borderColor: tab === t.id ? t.color : "#1e293b", color: tab === t.id ? "#fff" : "#64748b", transform: tab === t.id ? "translateY(-2px)" : "none", boxShadow: tab === t.id ? "0 4px 16px " + t.color + "44" : "none" }}>
                  {!isMobile && <span style={{ opacity: .4, marginRight: 5, fontSize: 10, fontFamily: "monospace" }}>{t.num} </span>}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Panel */}
            <div style={{ background: "#0a1628", border: "1px solid #0f172a", borderRadius: 16, padding: panelPad, opacity: tabVisible ? 1 : 0, transform: tabVisible ? "translateY(0)" : "translateY(6px)", transition: "opacity 0.18s, transform 0.18s" }}>

              {/* TOKENS */}
              {tab === "tokens" && (
                <div>
                  <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#64748b", marginBottom: 4 }}>Step 1 — Tokenization</p>
                  <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 18 }}>
                    Your sentence split into tokens. Click any chip to see its attention pattern.
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
                    {tokens.map((token, i) => {
                      const c = PALETTE[i % PALETTE.length]
                      const isSel = selectedToken === i
                      return (
                        <div key={i} onClick={() => handleTokenClick(i)}
                          style={{ background: c.bg, border: "1.5px solid " + (isSel ? "#fff" : c.border), color: c.text, padding: isMobile ? "7px 12px" : "9px 16px", borderRadius: 9, fontFamily: "monospace", fontSize: isMobile ? 13 : 14, fontWeight: 600, cursor: "pointer", transform: isSel ? "scale(1.08) translateY(-2px)" : "scale(1)", transition: "all 0.22s cubic-bezier(0.34,1.56,0.64,1)", boxShadow: isSel ? "0 6px 20px " + c.hex + "55" : "none", animation: `fadeSlideIn 0.3s ease ${i * 0.06}s both` }}>
                          {token}
                          <span style={{ marginLeft: 6, opacity: .35, fontSize: 10 }}>#{i}</span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Token table — hide Chars and Click on mobile */}
                  <div style={{ background: "#060b14", borderRadius: 10, overflow: "hidden", border: "1px solid #0f172a" }}>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "36px 1fr" : "40px 1fr 70px 90px", padding: "8px 12px", borderBottom: "1px solid #0f172a", fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: ".07em" }}>
                      <span>Pos</span><span>Token</span>
                      {!isMobile && <><span>Chars</span><span>Click</span></>}
                    </div>
                    {tokens.map((token, i) => {
                      const c = PALETTE[i % PALETTE.length]
                      const isSel = selectedToken === i
                      return (
                        <div key={i} onClick={() => handleTokenClick(i)}
                          style={{ display: "grid", gridTemplateColumns: isMobile ? "36px 1fr" : "40px 1fr 70px 90px", padding: "9px 12px", borderBottom: "1px solid #0f172a", background: isSel ? c.bg + "66" : "transparent", cursor: "pointer", transition: "background 0.18s", alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>{i}</span>
                          <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: c.text }}>{token}</span>
                          {!isMobile && <>
                            <span style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>{token.length}</span>
                            <span style={{ fontSize: 11, color: isSel ? c.border : "#1e293b" }}>{isSel ? "● selected" : "click →"}</span>
                          </>}
                        </div>
                      )
                    })}
                  </div>
                  <ConceptCard tab="tokens" />
                </div>
              )}

              {/* ATTENTION */}
              {tab === "attention" && (
                <div>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#64748b", marginBottom: 4 }}>Step 2 — Attention weights</p>
                      <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>Click a token node to see which words it attends to. Thicker arc = higher weight.</p>
                    </div>
                    <div style={{ background: "#060b14", borderRadius: 9, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 4 }}>L{layer}/11</div>
                        <input type="range" min={0} max={Math.max((attention.length || 1) - 1, 11)} value={layer} onChange={e => setLayer(Number(e.target.value))} style={{ width: isMobile ? 70 : 90, accentColor: "#3b82f6" }} />
                      </div>
                      {!isMobile && <div style={{ fontSize: 11, color: "#94a3b8", maxWidth: 100 }}>{layer <= 2 ? "Syntax" : layer <= 5 ? "Phrases" : layer <= 8 ? "Facts" : "Abstract"}</div>}
                    </div>
                  </div>

                  <AttentionCanvas tokens={tokens} weights={currentAttention} selectedToken={selectedToken} onSelect={setSelectedToken} />

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, marginBottom: 12 }}>
                    {tokens.map((token, i) => {
                      const c = PALETTE[i % PALETTE.length]
                      const isSel = selectedToken === i
                      return (
                        <button key={i} onClick={() => setSelectedToken(prev => prev === i ? null : i)}
                          style={{ background: isSel ? c.bg : "#060b14", border: "1px solid " + (isSel ? c.border : "#1e293b"), color: isSel ? c.text : "#64748b", padding: "5px 10px", borderRadius: 6, fontFamily: "monospace", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all .15s" }}>
                          {token}
                        </button>
                      )
                    })}
                  </div>

                  <div style={{ background: "#060b14", borderRadius: 9, padding: "12px 14px", fontSize: 13, color: "#94a3b8", lineHeight: 1.75, borderLeft: "3px solid #3b82f6" }}>
                    {selectedToken !== null ? (
                      <><span style={{ color: "#93c5fd", fontWeight: 700 }}>"{tokens[selectedToken]}"</span>{" "}is computing Attention(Q,K,V). Each arc = softmax(Q·K^T / sqrt(768)). Drag layer slider to see how attention shifts.</>
                    ) : "Click a token node above or use the buttons."}
                  </div>
                  <ConceptCard tab="attention" />
                </div>
              )}

              {/* EMBEDDINGS */}
              {tab === "embeddings" && (
                <div>
                  <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#64748b", marginBottom: 4 }}>Step 3 — Embeddings</p>
                  <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 18 }}>
                    Each token = 768 numbers. Each square = one dimension. Hover to see exact value.
                    {isMobile && " (showing 16 of 768)"}
                  </p>
                  <EmbeddingHeatmap tokens={tokens} embeddings={embeddings} />
                  <ConceptCard tab="embeddings" />
                </div>
              )}

              {/* OUTPUT */}
              {tab === "output" && (
                <div>
                  <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#64748b", marginBottom: 4 }}>Step 4 — Next token prediction</p>
                  <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.6, marginBottom: 18 }}>
                    Two models predict the next word. See how model size changes accuracy.
                  </p>

                  <div style={{ fontFamily: "monospace", fontSize: 13, color: "#94a3b8", marginBottom: 20, padding: "12px 14px", background: "#060b14", borderRadius: 9, wordBreak: "break-all" }}>
                    "{sentence}"<span style={{ color: "#f59e0b" }}> → ???</span>
                  </div>

                  {/* Two columns — stack on mobile */}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>

                    {/* Local model */}
                    <div style={{ background: "#060b14", border: "1px solid #1e293b", borderRadius: 12, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", fontFamily: "monospace" }}>LOCAL MODEL</span>
                        <span style={{ fontSize: 10, padding: "2px 8px", background: "#2d1b69", color: "#c4b5fd", borderRadius: 99, border: "1px solid #7c3aed44" }}>{modelName || "loading"}</span>
                      </div>

                      <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, marginBottom: 14, padding: "10px 12px", background: "#0a1628", borderRadius: 8, borderLeft: "3px solid #7c3aed" }}>
                        Runs 100% in your browser. No internet after download. Small model (~500M params) — shows real transformer internals but has limited world knowledge.
                      </div>

                      {status === "running" && !localProbs.length && (
                        <div style={{ textAlign: "center", padding: "16px 0", color: "#64748b", fontSize: 12, animation: "pulse 1s infinite" }}>Running forward pass…</div>
                      )}

                      {localProbs.length > 0 && <ProbBars probs={localProbs} />}

                      <div style={{ marginTop: 12, padding: "8px 10px", background: "#0a1628", borderRadius: 7, fontSize: 11, color: "#64748b", display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ color: "#22c55e" }}>✓ Free forever</span>
                        <span style={{ color: "#22c55e" }}>✓ Works offline</span>
                        <span style={{ color: "#ef4444" }}>✗ Limited knowledge</span>
                      </div>
                    </div>

                    {/* Groq */}
                    <div style={{ background: "#060b14", border: "1px solid #1e293b", borderRadius: 12, padding: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", fontFamily: "monospace" }}>GROQ API</span>
                        <span style={{ fontSize: 10, padding: "2px 8px", background: "#78350f", color: "#fde68a", borderRadius: 99, border: "1px solid #f59e0b44" }}>Llama-3.1-8B</span>
                      </div>

                      <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, marginBottom: 14, padding: "10px 12px", background: "#0a1628", borderRadius: 8, borderLeft: "3px solid #f59e0b" }}>
                        Runs Llama 3.1 8B on Groq's cloud. 8 billion parameters — understands facts, grammar, and long-range context.
                      </div>

                      {groqStatus === "running" && !groqProbs.length && (
                        <div style={{ textAlign: "center", padding: "16px 0", color: "#64748b", fontSize: 12, animation: "pulse 1s infinite" }}>Calling Llama 3.1…</div>
                      )}

                      {!import.meta.env.VITE_GROQ_KEY && groqStatus !== "running" && !groqProbs.length && (
                        <div style={{ padding: "12px", background: "#1a0a00", borderRadius: 8, fontSize: 12, color: "#92400e", lineHeight: 1.7 }}>
                          Add VITE_GROQ_KEY to .env to enable. Free key at console.groq.com — no credit card.
                        </div>
                      )}

                      {groqProbs.length > 0 && <ProbBars probs={groqProbs} />}

                      <div style={{ marginTop: 12, padding: "8px 10px", background: "#0a1628", borderRadius: 7, fontSize: 11, color: "#64748b", display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ color: "#22c55e" }}>✓ 8B params</span>
                        <span style={{ color: "#22c55e" }}>✓ Factual</span>
                        <span style={{ color: "#ef4444" }}>✗ Needs internet</span>
                      </div>
                    </div>
                  </div>

                  {/* Why two models */}
                  <div style={{ marginTop: 18, background: "#060b14", borderRadius: 12, padding: "16px", border: "1px solid #1e293b" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".07em" }}>Why two models?</p>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12, fontSize: 12, color: "#94a3b8", lineHeight: 1.7 }}>
                      <div>
                        <span style={{ color: "#7c3aed", fontWeight: 600 }}>Local model</span>{" "}shows real transformer internals — actual embeddings, real attention, genuine forward pass. You see HOW transformers work.
                      </div>
                      <div>
                        <span style={{ color: "#f59e0b", fontWeight: 600 }}>Groq / Llama 3.1</span>{" "}shows what transformers know at scale. 8B params can store facts a 500M browser model cannot.
                      </div>
                    </div>
                    <div style={{ marginTop: 12, padding: "10px 12px", background: "#0a1628", borderRadius: 8, fontSize: 12, color: "#64748b", lineHeight: 1.7 }}>
                      This comparison IS the insight: <span style={{ color: "#f1f5f9" }}>scale matters in AI</span>. Same architecture. Same math. Only parameters differ. Yet outputs are completely different.
                    </div>
                  </div>

                  <ConceptCard tab="output" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <Analytics />
    </div>
  )
}
