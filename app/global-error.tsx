'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ru">
      <body>
        <div style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif" }}>
          <h2>Критическая ошибка / Critical Error</h2>
          <button onClick={() => reset()}>Попробовать снова</button>
        </div>
      </body>
    </html>
  )
}
