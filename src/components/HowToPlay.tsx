import { APP_VERSION } from '../version.ts';

const BIOME_COLORS: Record<string, string> = {
  Red: '#E74C3C',
  Blue: '#3498DB',
  Cream: '#F5E6CC',
  Brown: '#8B4513',
  Green: '#27AE60',
};

const KEYWORDS = [
  { name: 'Produce X', desc: 'Generates X resources when this card appears on the activation line.' },
  { name: 'Fast', desc: 'Attacks before the normal combat phase.' },
  { name: 'Slow', desc: 'Attacks after the normal combat phase.' },
  { name: 'Regenerate X', desc: 'Heals self for X at the start of each spin.' },
  { name: 'Thorns X', desc: 'Deals X damage back to any card that attacks this one.' },
  { name: 'Bolster X', desc: 'Cards in adjacent columns deal +X damage.' },
  { name: 'Healing X', desc: 'Heals cards in adjacent columns for X each spin.' },
  { name: 'Venomous X', desc: 'Applies X poison counters on hit. Poison deals damage each spin then fades.' },
  { name: 'Poisonous X', desc: 'Applies X poison counters to any card that attacks this one.' },
  { name: 'Angry', desc: 'Deals +50% damage when below 50% health.' },
];

interface HowToPlayProps {
  onClose: () => void;
  onStartTutorial: () => void;
}

export function HowToPlay({ onClose, onStartTutorial }: HowToPlayProps) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.85)',
      zIndex: 600,
      overflow: 'auto',
      color: '#eee',
    }}>
      <div style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '40px 24px 80px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h1 className="font-display" style={{ color: '#f1c40f', fontSize: 32, margin: 0 }}>
            How to Play
          </h1>
          <button onClick={onClose} style={closeBtnStyle}>&times;</button>
        </div>

        {/* Quick start */}
        <Section title="Overview">
          <p>
            Spin Critters is a slot-machine card battler. You build a team of critters and support cards
            arranged in a 5-column reel grid, then battle AI opponents. Each spin randomly selects one
            card per column to fight. Win battles, shop for upgrades, and be the last player standing.
          </p>
          <button onClick={() => { onStartTutorial(); onClose(); }} style={tutorialBtnStyle}>
            Play with Interactive Tutorial
          </button>
        </Section>

        {/* Game Flow */}
        <Section title="Game Flow">
          <Phase num={1} name="Pick Critters" color="#f1c40f">
            Choose 3 critters from the 25 available (max 2 from the same biome).
            Place each into one of the 5 reel columns. The other 2 columns start empty.
          </Phase>
          <Phase num={2} name="Draft Cards" color="#3498db">
            Open 7 card packs (5 Common, 2 Uncommon). Pick 1 card from each pack and place it
            in a column. Empty slots are filled with Junk (0 attack, 1 health).
          </Phase>
          <Phase num={3} name="Battle" color="#e74c3c">
            Fight an opponent over up to 10 spins. Each spin randomly selects one living card
            per column to the activation line. Cards attack the opposing card in the same column.
            After 10 spins, overtime damage kicks in. The loser takes morale damage.
          </Phase>
          <Phase num={4} name="Shop" color="#27ae60">
            Spend resources to buy new cards for your reels. You can reroll the shop for 2 resources
            or skip. Every other battle, your reel grows by one row (filled with Junk).
          </Phase>
          <Phase num={5} name="Repeat" color="#9b59b6">
            Battle and shop until only one player remains. If your morale hits 0, you're eliminated.
          </Phase>
        </Section>

        {/* Battle Details */}
        <Section title="Battle Mechanics">
          <SubSection title="Spin & Attack">
            Each spin, one living card per column appears on the activation line.
            Your column 1 card fights their column 1 card, column 2 vs column 2, etc.
            If a column has no opponent, damage redirects to an adjacent column.
          </SubSection>
          <SubSection title="Attack Phases">
            <ol style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li><strong>Fast phase</strong> — Cards with Fast attack first</li>
              <li><strong>Regular phase</strong> — All normal cards attack simultaneously</li>
              <li><strong>Slow phase</strong> — Cards with Slow attack last</li>
            </ol>
          </SubSection>
          <SubSection title="Resources">
            You gain 3 resources each spin, plus bonus from Produce cards.
            Resources carry over to the shop phase for purchasing new cards.
          </SubSection>
          <SubSection title="CRITs">
            If all 5 active cards share the same <strong>biome</strong>, a powerful
            biome CRIT triggers. If they share the same <strong>archetype</strong>,
            all critters of that type gain XP toward evolution.
          </SubSection>
          <SubSection title="Overtime">
            After spin 10, all active cards take increasing damage each spin
            (spin 11 = 1 dmg, spin 12 = 2 dmg, etc.) to force a conclusion.
          </SubSection>
        </Section>

        {/* Biomes */}
        <Section title="Biomes">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(BIOME_COLORS).map(([name, color]) => (
              <span key={name} style={{
                background: color,
                color: name === 'Cream' ? '#333' : '#fff',
                padding: '4px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
              }}>
                {name}
              </span>
            ))}
          </div>
          <p style={{ color: '#aaa', fontSize: 13, marginTop: 8 }}>
            Each critter belongs to one biome (color) and one archetype (Insect, Mammal, Reptile, Avian, Aquatic).
          </p>
        </Section>

        {/* Card Types */}
        <Section title="Card Types">
          <CardType name="Critters" desc="Your main fighters. 4 attack, 30 health. Gain XP and evolve to get stronger." />
          <CardType name="Allies" desc="Support fighters with varied stats and keywords. Come in Common, Uncommon, and Rare." />
          <CardType name="Locations" desc="Don't attack but generate resources (Produce) and may heal or buff neighbors." />
          <CardType name="Relics" desc="Fragile but powerful keyword effects like Thorns, Bolster, and Regenerate." />
          <CardType name="Junk" desc="0 attack, 1 health. Fills empty slots. Awards your opponent 1 resource when destroyed." />
        </Section>

        {/* Keywords */}
        <Section title="Keywords">
          <div style={{ display: 'grid', gap: 6 }}>
            {KEYWORDS.map((kw) => (
              <div key={kw.name} style={{
                display: 'flex',
                gap: 12,
                padding: '6px 0',
                borderBottom: '1px solid #222',
              }}>
                <strong style={{ minWidth: 120, color: '#f1c40f', fontSize: 13 }}>{kw.name}</strong>
                <span style={{ color: '#aaa', fontSize: 13 }}>{kw.desc}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Tips */}
        <Section title="Tips">
          <ul style={{ paddingLeft: 20, color: '#aaa', lineHeight: 1.8, fontSize: 14 }}>
            <li>Place strong cards in the same column as the opponent's weak ones</li>
            <li>Locations in a column with high-health critters keep generating resources safely</li>
            <li>Thorns cards punish opponents for attacking — great for columns facing heavy hitters</li>
            <li>Replace Junk as quickly as possible — it gives your opponent free resources</li>
            <li>Pay attention to biome colors when drafting for potential CRITs</li>
          </ul>
        </Section>

        <p style={{ textAlign: 'center', color: '#555', fontSize: 11, marginTop: 40 }}>
          {APP_VERSION}
        </p>
      </div>
    </div>
  );
}

/* ---- Small sub-components ---- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 className="font-display" style={{ color: '#ccc', fontSize: 20, marginBottom: 10, borderBottom: '1px solid #333', paddingBottom: 6 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h3 style={{ color: '#ddd', fontSize: 14, marginBottom: 4 }}>{title}</h3>
      <div style={{ color: '#aaa', fontSize: 14, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function Phase({ num, name, color, children }: { num: number; name: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
      <div style={{
        minWidth: 28, height: 28, borderRadius: '50%', background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 'bold', fontSize: 14, color: '#fff', marginTop: 2,
      }}>
        {num}
      </div>
      <div>
        <strong style={{ color: '#eee', fontSize: 15 }}>{name}</strong>
        <p style={{ color: '#aaa', fontSize: 14, margin: '4px 0 0', lineHeight: 1.6 }}>{children}</p>
      </div>
    </div>
  );
}

function CardType({ name, desc }: { name: string; desc: string }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <strong style={{ color: '#ddd', fontSize: 14 }}>{name}</strong>
      <span style={{ color: '#888', fontSize: 13, marginLeft: 8 }}>— {desc}</span>
    </div>
  );
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: '2px solid #555', borderRadius: 8,
  color: '#aaa', cursor: 'pointer', fontSize: 24, padding: '2px 12px',
  lineHeight: 1,
};

const tutorialBtnStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '10px 24px',
  fontSize: 14,
  fontWeight: 'bold',
  background: 'linear-gradient(180deg, #f39c12, #e67e22)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};
