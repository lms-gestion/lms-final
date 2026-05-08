import { LoginForm } from './login-form'

export const metadata = { title: 'Connexion' }

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-block bg-white rounded-2xl p-3 mb-4 shadow-lg">
            <svg viewBox="0 0 200 175" fill="none" width="48" height="42">
              <path d="M100 10 L188 78 L188 165 L12 165 L12 78 Z" fill="#0F2644" />
              <rect x="116" y="100" width="72" height="65" rx="7" fill="#F5A623" />
            </svg>
          </div>
          <h1 className="text-xl font-black text-white tracking-wide">LA MAISON</h1>
          <h2 className="text-xl font-black text-[#F5A623] tracking-wide">DES SERVICES</h2>
          <p className="text-xs uppercase tracking-widest text-white/40 mt-2">Espace Gestion Interne</p>
        </div>
        <LoginForm />
      </div>
      <p className="text-center text-xs text-white/30 mt-6">LMS Gestion v0.1 · La Maison des Services</p>
    </div>
  )
}
