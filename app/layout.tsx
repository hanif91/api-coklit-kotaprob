export const metadata = {
  title: 'Api Perumdam Bayuangga',
  description: 'Api Perumdam Bayuangga',
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
