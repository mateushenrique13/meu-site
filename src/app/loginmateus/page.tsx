"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    if (res?.error) {
      setError("Email ou senha incorretos.")
      setLoading(false)
      return
    }

    router.push("/dashboard")
  }

  return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-full max-w-sm">
        <h1 className="text-white text-2xl font-light tracking-widest text-center mb-8">
          acesso restrito
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-transparent border border-white/20 text-white px-4 py-3 rounded-lg outline-none focus:border-white/60 transition placeholder:text-white/30 text-sm"
            required
          />
          <input
            type="password"
            placeholder="senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-transparent border border-white/20 text-white px-4 py-3 rounded-lg outline-none focus:border-white/60 transition placeholder:text-white/30 text-sm"
            required
          />
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-white text-black py-3 rounded-lg text-sm font-medium hover:bg-white/90 transition disabled:opacity-50"
          >
            {loading ? "entrando..." : "entrar"}
          </button>
        </form>
      </div>
    </main>
  )
}