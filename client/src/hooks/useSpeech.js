import { useRef, useState, useEffect, useCallback } from 'react'

// Use 'en-IN' for Roman-script Hinglish (can switch to 'hi-IN' if needed)
const HINGLISH_LANG = 'en-IN'

export function useSpeech(language = 'english') {
  const [speaking, setSpeaking] = useState(false)
  const [voicesReady, setVoicesReady] = useState(false)
  const utteranceRef = useRef(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return
    }

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      if (voices.length > 0) {
        setVoicesReady(true)
      }
    }

    updateVoices()
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices)

    return () => {
      window.speechSynthesis.cancel()
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoices)
    }
  }, [])

  const speak = useCallback((text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    const targetLang = language === 'hinglish' ? HINGLISH_LANG : 'en-US'
    utterance.lang = targetLang

    const voices = window.speechSynthesis.getVoices()
    const matchingVoice =
      voices.find((v) => v.lang === targetLang) ||
      voices.find((v) => v.lang.startsWith(targetLang.split('-')[0]))

    if (matchingVoice) {
      utterance.voice = matchingVoice
    }

    utterance.rate = 0.95

    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = (e) => {
      if (e.error !== 'canceled') {
        console.error('Speech error:', e)
      }
      setSpeaking(false)
    }

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }, [language])

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setSpeaking(false)
  }, [])

  return { speaking, voicesReady, speak, stop }
}
