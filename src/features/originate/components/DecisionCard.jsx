import { pct } from '../../../lib/format'

export function DecisionCard({ decision, grade, pd_12m }) {
  const pdPct = pd_12m == null ? 0 : pd_12m * 100
  const stampSrc =
    decision === 'APPROVE' ? '/assets/stamps/approved.svg' : '/assets/stamps/rejected.svg'
  const decisionColor = decision === 'APPROVE' ? '#16a34a' : '#dc2626'
  const pdColor =
    pd_12m == null
      ? '#666'
      : pd_12m < 0.10
        ? '#16a34a'
        : pd_12m <= 0.30
          ? '#eab308'
          : '#dc2626'

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        padding: 20,
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Column 1: Decision */}
        <div
          style={{
            flex: 1,
            paddingRight: 12,
            borderRight: '1px solid #eee',
            textAlign: 'center',
            paddingLeft: 12,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              // borderBottom: '2px solid #333',
              paddingBottom: 6,
              marginBottom: 12,
            }}
          >
            Decision
          </div>
          {(decision === 'APPROVE' || decision === 'DECLINE') && (
            <img
              src={stampSrc}
              alt={decision}
              style={{ width: 80, height: 80, objectFit: 'contain' }}
            />
          )}
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: decisionColor,
              marginTop: 8,
            }}
          >
            {/* {decision} */}
          </div>
        </div>

        {/* Column 2: Grade */}
        <div
          style={{
            flex: 1,
            paddingRight: 12,
            borderRight: '1px solid #eee',
            textAlign: 'center',
            paddingLeft: 12,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              // borderBottom: '2px solid #333',
              paddingBottom: 6,
              marginBottom: 12,
            }}
          >
            Grade
          </div>
          <div
            style={{
              fontFamily: "'Special Elite', cursive",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: '#dc2626',
              border: '3px solid #dc2626',
              borderRadius: 2,
              padding: '6px 16px',
              transform: 'rotate(-2deg)',
              textShadow: '0 0 1px rgba(220,38,38,0.4)',
              boxShadow: 'inset 0 0 4px rgba(220,38,38,0.15)',
              display: 'inline-block',
            }}
          >
            {grade}
          </div>
        </div>

        {/* Column 3: 12 Month PD */}
        <div style={{ flex: 1.6, textAlign: 'center', paddingLeft: 12 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#666',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              // borderBottom: '2px solid #333',
              paddingBottom: 6,
              marginBottom: 12,
            }}
          >
            12 Month PD
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: pdColor,
              marginBottom: 10,
            }}
          >
            {pct(pd_12m, 2)}
          </div>
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 36,
              background:
                'linear-gradient(90deg,#b0b0b0 0%,#d4d4d4 20%,#a8a8a8 50%,#d0d0d4 80%,#b0b0b0 100%)',
              border: '1px solid #888',
              borderRadius: 4,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                left: 10,
                right: 10,
                height: 4,
                background: '#555',
                borderRadius: 2,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                left: 10,
                height: 4,
                width: `${pdPct}%`,
                background: '#ff6b00',
                borderRadius: 2,
                boxShadow: '0 0 6px 2px rgba(255,107,0,0.6)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                left: `calc(10px + ${pdPct}% - 5px)`,
                width: 10,
                height: 28,
                background: 'linear-gradient(90deg,#e8e8e8,#999)',
                border: '1px solid #666',
                borderRadius: 2,
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: -18,
                left: 10,
                right: 10,
                height: 16,
              }}
            >
              {[0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100].map((pos) => {
                const major = [0, 25, 50, 75, 100].includes(pos)
                return (
                  <div
                    key={pos}
                    style={{
                      position: 'absolute',
                      left: `${pos}%`,
                      bottom: 0,
                      width: 1,
                      height: major ? 8 : 4,
                      background: major ? '#555' : '#999',
                    }}
                  />
                )
              })}
              {[0, 25, 50, 75, 100].map((pos) => (
                <div
                  key={`label-${pos}`}
                  style={{
                    position: 'absolute',
                    left: `${pos}%`,
                    bottom: -30,
                    fontSize: 9,
                    color: '#666',
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {pos}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
