/**
 * Offline-safe signature DRAFT validation only.
 * A drawn signature is not identity verification or certificate approval.
 * Never persist a sign-off until an authenticated, audited server RPC succeeds.
 */
export type SignaturePoint = { x: number; y: number; t: number };
export type SignatureStroke = SignaturePoint[];
export type SignatureDraft = { strokes: SignatureStroke[]; width: number; height: number };

const MAX_STROKES = 128;
const MAX_POINTS = 12000;
const MAX_DIMENSION = 8192;

export function validateSignatureDraft(value: unknown): SignatureDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid signature draft.');
  const draft = value as Partial<SignatureDraft>;
  if (!Number.isInteger(draft.width) || !Number.isInteger(draft.height) ||
      (draft.width as number) < 1 || (draft.height as number) < 1 ||
      (draft.width as number) > MAX_DIMENSION || (draft.height as number) > MAX_DIMENSION)
    throw new Error('Invalid signature canvas.');
  if (!Array.isArray(draft.strokes) || draft.strokes.length < 1 || draft.strokes.length > MAX_STROKES)
    throw new Error('Invalid signature strokes.');
  let count = 0;
  for (const stroke of draft.strokes) {
    if (!Array.isArray(stroke) || stroke.length < 2) throw new Error('Invalid signature stroke.');
    count += stroke.length;
    if (count > MAX_POINTS) throw new Error('Signature draft too large.');
    let previousTime = -Infinity;
    for (const point of stroke) {
      if (!point || typeof point !== 'object' || Array.isArray(point) ||
          !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.t) ||
          point.x < 0 || point.x > (draft.width as number) ||
          point.y < 0 || point.y > (draft.height as number) ||
          point.t < 0 || point.t < previousTime)
        throw new Error('Invalid signature point.');
      previousTime = point.t;
    }
  }
  return draft as SignatureDraft;
}
