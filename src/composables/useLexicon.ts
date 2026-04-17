export const useLexicon = () => {
  const lookupWord = async (term: string): Promise<{ definition: string; phonetic: string | null } | null> => {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`)
      if (!res.ok) return null
      const data = await res.json()
      const definition = data[0]?.meanings?.[0]?.definitions?.[0]?.definition ?? null
      const phonetic = data[0]?.phonetic ?? data[0]?.phonetics?.find((p: { text?: string }) => p.text)?.text ?? null
      if (!definition) return null
      return { definition, phonetic }
    } catch {
      return null
    }
  }

  return { lookupWord }
}
