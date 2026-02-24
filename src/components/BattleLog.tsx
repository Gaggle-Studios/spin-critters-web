import { useEffect, useRef } from 'react';
import type { BattleLogEntry } from '../engine/types.ts';

interface BattleLogProps {
  log: BattleLogEntry[];
}

export function BattleLog({ log }: BattleLogProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  return (
    <div style={{
      background: '#0d0d1a',
      border: '1px solid #333',
      borderRadius: 4,
      padding: 8,
      height: 180,
      overflowY: 'auto',
      fontFamily: 'monospace',
      fontSize: 11,
      color: '#ccc',
    }}>
      <div style={{ fontWeight: 'bold', color: '#aaa', marginBottom: 4 }}>BATTLE LOG</div>
      {log.map((entry, i) => (
        <div key={i} style={{
          padding: '1px 0',
          color: entry.message.includes('KO') ? '#e74c3c'
            : entry.message.includes('CRIT') ? '#f1c40f'
            : entry.message.includes('---') ? '#3498db'
            : entry.message.includes('wins') ? '#27ae60'
            : '#bbb',
        }}>
          {entry.message}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
