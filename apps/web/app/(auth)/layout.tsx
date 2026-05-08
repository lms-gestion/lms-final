export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #07172f 0%, #09265a 45%, #0f3b78 100%)',
      }}
    >
      {children}
    </div>
  )
}
