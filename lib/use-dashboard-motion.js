'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { EASE, play, reducedMotion, parseCount, formatCount } from '@/lib/motion.mjs'

// Port of TickIT Events' dashboard motion (docs/DASHBOARD_LAYOUT.md §5), selectors adapted to Orbit's components.
const TILE = '.stats-row > .stat'
const CARD = '.panel, .empty'
const ROW = '.dashboard-motion-row, tbody > tr, .page-heading .muted, .heading-actions > *'
const BAR_X = '.progress > div'
const POP = '.badge'
const COUNT = '.stat strong, [data-count]'
const ALL = [TILE, CARD, ROW, BAR_X, POP].join(', ')

const rise = (y, scale = 1) => [
  { opacity: 0, transform: `translateY(${y}px) scale(${scale})` },
  { opacity: 1, transform: 'none' },
]

let introPlayed = false

export function useDashboardMotion(pageKey) {
  const shellRef = useRef(null)

  // First paint of the workspace: sidebar slides in, its items follow, then the top bar drops in.
  useLayoutEffect(() => {
    const shell = shellRef.current
    if (!shell || introPlayed) return
    introPlayed = true
    if (innerWidth > 1100) {
      play(shell.querySelector('.sidebar'), [
        { opacity: 0, transform: 'translateX(-40px)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 600, easing: EASE.power3 })
      play(
        shell.querySelectorAll('.side-brand, .side-workspace, .side-label, .side-item, .side-footer > *'),
        [
          { opacity: 0, transform: 'translateX(-14px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 450, delay: 150, stagger: 25, max: 30, easing: EASE.power3 },
      )
    }
    play(shell.querySelectorAll('.dashboard-topbar > *'), rise(-16), {
      duration: 500,
      delay: 200,
      stagger: 40,
      easing: EASE.power3,
    })
  }, [])

  // Each page: cards rise in, KPI tiles tumble in, rows slide up, bars grow and figures count up.
  useEffect(() => {
    const shell = shellRef.current
    const main = shell?.querySelector('.dashboard-main')
    if (!main) return
    const seen = new WeakSet()
    const counters = new Map()

    const count = (el, from, duration, delay) => {
      const node = el.firstChild
      const state = counters.get(el)
      if (!node || node.nodeType !== 3 || el.childNodes.length !== 1) return
      cancelAnimationFrame(state.raf)
      const target = node.data
      const parsed = parseCount(target)
      state.written = state.target = target
      if (!parsed || parsed.value === from || reducedMotion()) return
      const start = performance.now() + delay
      const tick = (now) => {
        if (node.data !== state.written) {
          // React rendered a new figure mid-count: continue from what is on screen.
          const shown = parseCount(state.written)?.value ?? 0
          count(el, shown, 800, 0)
          return
        }
        const t = Math.min(1, Math.max(0, (now - start) / duration))
        state.written = node.data =
          t < 1 ? formatCount(parsed, from + (parsed.value - from) * (1 - (1 - t) ** 3)) : target
        state.raf = t < 1 ? requestAnimationFrame(tick) : 0
      }
      state.written = node.data = formatCount(parsed, from)
      state.raf = requestAnimationFrame(tick)
    }

    const enter = () => {
      const batch = { card: [], tile: [], row: [], barX: [], pop: [] }
      for (const el of main.querySelectorAll(ALL)) {
        if (seen.has(el)) continue
        seen.add(el)
        if (el.closest('.modal')) continue
        if (el.matches(TILE)) batch.tile.push(el)
        else if (el.matches(CARD)) {
          if (!el.parentElement.closest(`${CARD}, ${TILE}`)) batch.card.push(el)
        } else if (el.matches(ROW)) batch.row.push(el)
        else if (el.matches(BAR_X)) batch.barX.push(el)
        else batch.pop.push(el)
      }
      play(batch.card, rise(30, 0.985), { duration: 850, stagger: 60, max: 8, easing: EASE.power3 })
      play(
        batch.tile,
        (i) => [
          { opacity: 0, transform: `translateY(36px) rotate(${i % 2 ? 2.5 : -2.5}deg) scale(0.95)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 800, stagger: 60, easing: EASE.back14 },
      )
      play(batch.row, rise(10), { duration: 500, stagger: 35, max: 14, easing: EASE.power3 })
      for (const el of batch.barX) el.style.transformOrigin = '0 50%'
      play(batch.barX, [{ transform: 'scaleX(0)' }, { transform: 'none' }], {
        duration: 800,
        delay: 150,
        stagger: 60,
        easing: EASE.power3,
      })
      play(batch.pop, [
        { opacity: 0, transform: 'scale(0.6)' },
        { opacity: 1, transform: 'none' },
      ], { duration: 600, delay: 300, stagger: 40, easing: EASE.back24 })

      for (const el of main.querySelectorAll(COUNT)) {
        const state = counters.get(el)
        if (!state) {
          counters.set(el, { written: el.textContent, raf: 0 })
          count(el, 0, 1300, 150)
        } else if (!state.raf && el.textContent !== state.written) {
          // A figure changed after load: count from the old value and give it a little bump.
          count(el, parseCount(state.written)?.value ?? 0, 800, 0)
          el.classList.remove('is-flash')
          void el.offsetWidth
          el.classList.add('is-flash')
          play(el, [{ transform: 'translateY(-4px) scale(1.06)' }, { transform: 'none' }], {
            duration: 550,
            easing: EASE.back24,
          })
        }
      }
    }

    const observer = new MutationObserver((records) => {
      // Ignore the observer's own count-up frames.
      const ours = records.every(
        (r) => r.type === 'characterData' && counters.get(r.target.parentNode)?.written === r.target.data,
      )
      if (!ours) enter()
    })
    observer.observe(main, { childList: true, subtree: true, characterData: true })
    enter()

    const pointer = matchMedia('(hover: hover) and (pointer: fine)')
    let magnetic
    const resetMagnetic = () => {
      if (magnetic) magnetic.style.transform = ''
      magnetic = null
    }
    const move = (event) => {
      if (event.pointerType !== 'mouse' || !pointer.matches || reducedMotion()) return
      const target = event.target.closest('.heading-actions > [data-variant="default"], .top-create')
      if (target !== magnetic) resetMagnetic()
      if (!target) return
      magnetic = target
      const box = target.getBoundingClientRect()
      const x = Math.max(-5, Math.min(5, (event.clientX - box.left - box.width / 2) * 0.12))
      const y = Math.max(-4, Math.min(4, (event.clientY - box.top - box.height / 2) * 0.2))
      target.style.transform = `translate(${x}px, ${y}px)`
    }
    shell.addEventListener('pointermove', move)
    shell.addEventListener('pointerleave', resetMagnetic)

    return () => {
      observer.disconnect()
      for (const [el, state] of counters) {
        if (!state.raf) continue
        cancelAnimationFrame(state.raf)
        el.firstChild.data = state.target
      }
      resetMagnetic()
      shell.removeEventListener('pointermove', move)
      shell.removeEventListener('pointerleave', resetMagnetic)
    }
  }, [pageKey])

  return shellRef
}
