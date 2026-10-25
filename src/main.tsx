import '@fontsource-variable/inter'
import { LazyMotion, MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* LazyMotion + m.* keeps Motion small, and its features load in a separate file after
        first paint. reducedMotion="user" honours the OS "reduce motion" setting. */}
    <LazyMotion features={() => import('./motion-features').then((r) => r.default)} strict>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </LazyMotion>
  </StrictMode>,
)
