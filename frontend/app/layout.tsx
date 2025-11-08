import './globals.css'

export const metadata = {
  title: 'Suryamas',
  description: 'Finance Management System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
