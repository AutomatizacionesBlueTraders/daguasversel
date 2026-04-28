import { useEffect, useState } from 'react';

type ZxcvbnResult = {
  score: 0 | 1 | 2 | 3 | 4;
  feedback?: { warning?: string; suggestions?: string[] };
};
type ZxcvbnFn = (password: string, userInputs?: string[]) => ZxcvbnResult;

let zxcvbnPromise: Promise<ZxcvbnFn> | null = null;
function loadZxcvbn(): Promise<ZxcvbnFn> {
  if (!zxcvbnPromise) {
    zxcvbnPromise = import('zxcvbn').then((m) => (m.default ?? m) as unknown as ZxcvbnFn);
  }
  return zxcvbnPromise;
}

export interface StrengthEvaluation {
  score: 0 | 1 | 2 | 3 | 4;
  warning?: string;
  suggestions?: string[];
}

export async function evaluatePassword(
  password: string,
  userInputs: string[] = []
): Promise<StrengthEvaluation | null> {
  if (!password) return null;
  const zxcvbn = await loadZxcvbn();
  const clean = userInputs.filter((s) => typeof s === 'string' && s.length > 0);
  const r = zxcvbn(password, clean);
  return {
    score: r.score,
    warning: r.feedback?.warning,
    suggestions: r.feedback?.suggestions,
  };
}

interface Props {
  password: string;
  userInputs?: string[];
  minScore?: number;
}

const LABELS = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente'] as const;
const COLORS = ['bg-destructive', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600'];

export default function PasswordStrengthMeter({ password, userInputs = [], minScore = 3 }: Props) {
  const [r, setR] = useState<StrengthEvaluation | null>(null);

  useEffect(() => {
    if (!password) {
      setR(null);
      return;
    }
    let cancelled = false;
    void evaluatePassword(password, userInputs).then((x) => {
      if (!cancelled) setR(x);
    });
    return () => {
      cancelled = true;
    };
  }, [password, userInputs.join('|')]);

  if (!password) return null;
  if (!r) {
    return <p className="text-xs text-muted-foreground">Evaluando…</p>;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= r.score ? COLORS[r.score] : 'bg-muted'}`}
          />
        ))}
      </div>
      <p className={`text-xs ${r.score >= minScore ? 'text-emerald-600' : 'text-muted-foreground'}`}>
        Fortaleza: <span className="font-medium">{LABELS[r.score]}</span>
        {r.score < minScore && r.warning ? <> — {r.warning}</> : null}
      </p>
      {r.score < minScore && r.suggestions && r.suggestions.length > 0 ? (
        <ul className="text-xs text-muted-foreground list-disc pl-4">
          {r.suggestions.slice(0, 2).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
