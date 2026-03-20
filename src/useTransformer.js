import { useState, useCallback, useRef } from "react"
import { pipeline, env } from "@xenova/transformers"
import { groqPredict } from "./claudepredict.js"

env.allowLocalModels = false
env.useBrowserCache = true

let instance = null

function softmax(arr) {
  // Use loop instead of spread — Math.max(...arr) crashes on 50k+ values
  let max = -Infinity
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > max) max = arr[i]
  }
  let sum = 0
  const exps = new Float32Array(arr.length)
  for (let i = 0; i < arr.length; i++) {
    exps[i] = Math.exp(arr[i] - max)
    sum += exps[i]
  }
  for (let i = 0; i < arr.length; i++) {
    exps[i] /= sum
  }
  return exps
}

function simAttention(sentence, n) {
  return Array.from({ length: 12 }, (_, l) =>
    Array.from({ length: n }, (_, i) => {
      const row = Array.from({ length: n }, (_, j) => {
        const seed = sentence.charCodeAt((i + j) % sentence.length) || 1
        const w = Math.abs(Math.sin(i * 1.7 + j * 2.3 + l * 0.9 + seed * 0.01))
          * (j <= i ? 1 : 0.05)
        return w
      })
      const sum = row.reduce((a, b) => a + b, 0) || 1
      return row.map(w => w / sum)
    })
  )
}

function simEmbeddings(tokens) {
  return tokens.map(token =>
    Array.from({ length: 32 }, (_, k) => {
      let hash = 0
      for (const c of token) hash = (hash * 31 + c.charCodeAt(0)) % 1000
      return Math.abs(Math.sin(hash * 0.01 + k * 0.7))
    })
  )
}

function extractTopWords(logitsData, tokenizer, k) {
  const probs = softmax(Array.from(logitsData))
  const top500 = probs
    .map((prob, id) => ({ prob, id }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, 500)

  const wordMap = {}
  for (const { prob, id } of top500) {
    const raw = tokenizer.decode([id], { skip_special_tokens: true })
    const isNewWord = raw[0] === " "
    const word = raw.trim()
    if (isNewWord && /^[a-zA-Z]{2,20}$/.test(word)) {
      wordMap[word] = (wordMap[word] || 0) + prob
    }
  }

  const sorted = Object.entries(wordMap)
    .map(([word, prob]) => ({ word, prob }))
    .sort((a, b) => b.prob - a.prob)
    .slice(0, k || 8)

  if (!sorted.length) return []
  const total = sorted.reduce((s, x) => s + x.prob, 0)
  return sorted.map(x => ({ ...x, prob: x.prob / total }))
}

export function useTransformer() {
  const [status, setStatus] = useState("idle")
  const [progress, setProgress] = useState(0)
  const [modelName, setModelName] = useState("")
  const [tokens, setTokens] = useState([])
  const [attention, setAttention] = useState([])
  const [embeddings, setEmbeddings] = useState([])
  const [localProbs, setLocalProbs] = useState([])
  const [groqProbs, setGroqProbs] = useState([])
  const [groqStatus, setGroqStatus] = useState("idle")
  const [error, setError] = useState(null)
  const loadingRef = useRef(false)

  const loadModel = useCallback(async () => {
    if (instance) return instance
    if (loadingRef.current) return null
    loadingRef.current = true
    setStatus("loading")
    setProgress(0)

    const MODELS = [
      "Xenova/Qwen1.5-0.5B",
      "Xenova/gpt2-medium",
      "Xenova/distilgpt2",
    ]

    for (const name of MODELS) {
      try {
        console.log("Trying:", name)
        instance = await pipeline("text-generation", name, {
          progress_callback: (p) => {
            if (p.status === "progress" && p.total) {
              setProgress(Math.round((p.loaded / p.total) * 100))
            }
            if (p.status === "done") setProgress(100)
          }
        })
        setModelName(name.split("/")[1])
        setStatus("ready")
        loadingRef.current = false
        return instance
      } catch (e) {
        console.warn("Failed:", name, e.message)
        instance = null
      }
    }

    setError("All models failed")
    setStatus("error")
    loadingRef.current = false
    return null
  }, [])

  const run = useCallback(async (sentence) => {
    if (!sentence.trim()) {
      setTokens([])
      setAttention([])
      setEmbeddings([])
      setLocalProbs([])
      setGroqProbs([])
      return
    }

    const model = instance || await loadModel()
    if (!model) return

    const tokenizer = model.tokenizer
    let realTokens = sentence.trim().split(/\s+/)

    try {
      const encoded = tokenizer(sentence, { return_tensors: "pt" })
      const ids = Array.from(encoded.input_ids.data)
      const decoded = ids
        .map(id => tokenizer.decode([id], { skip_special_tokens: true }))
        .filter(t => t.trim().length > 0)
      if (decoded.length > 0) realTokens = decoded
    } catch (e) {
      console.warn("tokenizer fallback")
    }

    setTokens(realTokens)
    setAttention(simAttention(sentence, realTokens.length))
    setEmbeddings(simEmbeddings(realTokens))

    // Run both in parallel
    setStatus("running")
    setGroqStatus("running")
    setLocalProbs([])
    setGroqProbs([])

    // Local model inference
   const localPromise = (async () => {
  try {
    const tfModel = model.model
    const tokenizer = model.tokenizer

    // Tokenize directly — don't reuse outer realTokens
    const inputs = tokenizer(sentence, {
      return_tensors: "pt",
      padding: false,
      truncation: true,
    })

    // Verify we have valid input ids
    const inputIds = Array.from(inputs.input_ids.data)
    console.log("Input IDs:", inputIds)
    if (!inputIds || inputIds.length === 0) {
      throw new Error("Empty input_ids from tokenizer")
    }

    const output = await tfModel(inputs)
    console.log("Output keys:", Object.keys(output))

    const logits = output.logits
    console.log("Logits dims:", logits.dims)

    const seqLen = logits.dims[1]
    const vocabSize = logits.dims[2]
    const offset = (seqLen - 1) * vocabSize
    const lastLogits = logits.data.slice(offset, offset + vocabSize)
    const results = extractTopWords(lastLogits, tokenizer, 8)
    console.log("Local results:", results)

    if (results.length > 0) {
      setLocalProbs(results)
      setStatus("ready")
      return
    }

    // Fallback — greedy generation
    throw new Error("no words from logits, trying greedy")

  } catch (e) {
    console.warn("Logits path failed:", e.message, "→ trying greedy")
    try {
      const out = await model(sentence, {
        max_new_tokens: 6,
        do_sample: false,
        return_full_text: false,
      })
      const text = out?.[0]?.generated_text || ""
      console.log("Greedy output:", text)
      const words = text.trim().split(/\s+/)
        .map(w => w.replace(/[^a-zA-Z]/g, ""))
        .filter(w => /^[a-zA-Z]{2,20}$/.test(w))
        .slice(0, 6)

      if (words.length > 0) {
        const fallback = words.map((word, i) => ({
          word, prob: Math.pow(0.55, i)
        }))
        const ft = fallback.reduce((s, x) => s + x.prob, 0)
        setLocalProbs(fallback.map(x => ({ ...x, prob: x.prob / ft })))
      }
      setStatus("ready")
    } catch (e2) {
      console.error("Greedy also failed:", e2.message)
      setStatus("ready")
    }
  }
})()
    // Groq inference
    const groqPromise = (async () => {
      try {
        const preds = await groqPredict(sentence)
        setGroqProbs(preds)
        setGroqStatus("ready")
      } catch (e) {
        console.warn("Groq failed:", e.message)
        setGroqStatus("error")
      }
    })()

    await Promise.allSettled([localPromise, groqPromise])

  }, [loadModel])

  return {
    status, progress, modelName,
    tokens, attention, embeddings,
    localProbs, groqProbs, groqStatus,
    error, run, loadModel
  }
}