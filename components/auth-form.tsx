'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Eye, EyeOff, Shield } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    const result = isSignUp
      ? await authClient.signUp.email({ name, email, password })
      : await authClient.signIn.email({ email, password })
    setPending(false)
    if (result.error) {
      setError('Unable to authenticate with those details. Check your information and try again.')
      return
    }
    router.push('/')
    router.refresh()
  }

  return <div className="w-full max-w-md rounded-2xl border border-white/[0.09] bg-[#0d151d] p-7 shadow-2xl shadow-black/30">
    <div className="mb-7 flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300"><Shield size={20} /></div><div><p className="font-semibold text-white">NileGuard <span className="text-cyan-300">AI</span></p><p className="text-[11px] text-slate-500">Security operations center</p></div></div>
    <div className="mb-6"><p className="mb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-cyan-300/80">Operator access</p><h1 className="text-2xl font-semibold tracking-tight text-white">{isSignUp ? 'Create your operator account' : 'Welcome back, operator'}</h1><p className="mt-2 text-sm leading-6 text-slate-500">{isSignUp ? 'Set up secure access to your threat console.' : 'Sign in to continue monitoring your protected hosts.'}</p></div>
    <form onSubmit={submit} className="flex flex-col gap-4">
      {isSignUp && <label className="flex flex-col gap-2 text-xs font-medium text-slate-400">Full name<input required value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50" placeholder="Alex Morgan" /></label>}
      <label className="flex flex-col gap-2 text-xs font-medium text-slate-400">Work email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/50" placeholder="operator@company.com" /></label>
      <label className="flex flex-col gap-2 text-xs font-medium text-slate-400">Password<div className="relative"><input required minLength={8} type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 pr-10 text-sm text-white outline-none focus:border-cyan-400/50" placeholder="Minimum 8 characters" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" aria-label="Toggle password visibility">{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
      {error && <p role="alert" className="flex items-center gap-2 text-xs text-red-300"><AlertCircle size={14} />{error}</p>}
      <button disabled={pending} className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60">{pending ? 'Securing access…' : isSignUp ? 'Create account' : 'Sign in'} {!pending && <ArrowRight size={15} />}</button>
    </form>
    <p className="mt-6 text-center text-xs text-slate-500">{isSignUp ? 'Already have an account?' : 'Need operator access?'} <a className="font-medium text-cyan-300 hover:text-cyan-200" href={isSignUp ? '/sign-in' : '/sign-up'}>{isSignUp ? 'Sign in' : 'Register'}</a></p>
    <p className="mt-6 border-t border-white/[0.07] pt-5 text-center text-[10px] text-slate-600">Protected by NileGuard secure session controls</p>
  </div>
}
