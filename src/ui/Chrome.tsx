import { useStore } from '../store'
import { reg } from './dom'

/** persistent instrument chrome: boot screen, camera rail, hint line,
 *  false-color legend, scroll cue, and the shadow-radius annotation ring */
export default function Chrome() {
  const s = useStore()
  return (
    <>
      {/* lensed-shadow annotation: dashed critical-impact-parameter circle */}
      <svg className="anno" ref={reg('annoWrap')} width="100%" height="100%">
        <circle ref={reg('annoCircle')} cx="50%" cy="50%" r="120" />
        <line ref={reg('annoLine')} x1="50%" y1="50%" x2="50%" y2="50%" />
        <text ref={reg('annoText')} x="0" y="0">
          b_c = 3√3 GM/c²
        </text>
      </svg>

      <div className="rail" ref={reg('rail')} aria-hidden>
        <div className="ro" ref={reg('railRo')}>
          {''}
        </div>
        <div className="track">
          {Array.from({ length: 7 }, (_, i) => (
            <i key={i} style={{ top: `${(i / 6) * 100}%` }} />
          ))}
          <div className="thumb" ref={reg('railThumb')} />
        </div>
      </div>

      <div className="legend" ref={reg('legend')} aria-hidden>
        <div className="bar" />
        <div className="lab">
          <span>g = 0.6 · redshift</span>
          <span>1</span>
          <span>blueshift · 1.4</span>
        </div>
      </div>

      <div className="cue" ref={reg('cue')} aria-hidden>
        <div className="line" />
      </div>

      <div className={`boot${s.booted && !s.glError ? ' done' : ''}`}>
        <div className="bw">
          <div className="bt">Schwarzschild</div>
          {s.glError ? (
            <div className="berr">
              This page integrates photon geodesics on your GPU and needs
              WebGL2. {s.glError}
            </div>
          ) : (
            <div className="bs">integrating geodesics —</div>
          )}
        </div>
      </div>
    </>
  )
}
