"use client"
import { authClient } from "@/lib/auth-client"
import type React from "react"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ShieldAlert } from "lucide-react"

export default function DeviceAuthorizationPage() {
  const [userCode, setUserCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const formattedCode = userCode.trim().replace(/-/g, "").toUpperCase()

      const response = await authClient.device({
        query: { user_code: formattedCode },
      })

      if (response.data) {
        router.push(`/approve?user_code=${formattedCode}`)
      }
    } catch (err) {
      setError("Invalid or expired code")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
    if (value.length > 4) {
      value = value.slice(0, 4) + "-" + value.slice(4, 8)
    }
    setUserCode(value)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* Header Section */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="p-3 rounded-lg border-2 border-dashed border-violet-500/50 bg-violet-950/20">
            <ShieldAlert className="w-8 h-8 text-violet-400" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent mb-2">Device Authorization</h1>
            <p className="text-muted-foreground">Enter your device code to continue</p>
          </div>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="border-2 border-dashed border-violet-500/30 rounded-xl p-8 bg-zinc-950/80 backdrop-blur-sm"
        >
          <div className="space-y-6">
            {/* Code Input */}
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-foreground mb-2">
                Device Code
              </label>
              <input
                id="code"
                type="text"
                value={userCode}
                onChange={handleCodeChange}
                placeholder="XXXX-XXXX"
                maxLength={9}
                className="w-full px-4 py-3 bg-zinc-900 border-2 border-dashed border-violet-500/30 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 font-mono text-center text-lg tracking-widest transition-all"
              />
              <p className="text-xs text-muted-foreground mt-2">Find this code on the device you want to authorize</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-950 border border-red-900 text-red-200 text-sm">{error}</div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || userCode.length < 9}
              className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-lg hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/25"
            >
              {isLoading ? "Verifying..." : "Continue"}
            </button>

            {/* Info Box */}
            <div className="p-4 bg-zinc-900/50 border-2 border-dashed border-violet-500/20 rounded-lg">
              <p className="text-xs text-muted-foreground leading-relaxed">
                This code is unique to your device and will expire shortly. Keep it confidential and never share it with
                anyone.
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
