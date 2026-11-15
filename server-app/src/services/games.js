import { z } from 'zod';
import { GAME_MODES, isGroupTarget, STEP_TYPES } from '../data/gameMissions.js';
import { parseJson } from '../lib/text.js';

// Module Jeux : validation et mise en forme des missions.

const id = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/, 'Identifiant : minuscules, chiffres et tirets');

const questionSchema = z.object({
  q: z.string().trim().min(3).max(300),
  choices: z.array(z.string().trim().min(1).max(200)).min(2).max(5),
  answer: z.number().int().min(0),
  // Fiche qui fonde la réponse (identifiant de l'atlas ou d'une fiche culturelle).
  source: z.string().trim().min(1).max(200),
}).refine((q) => q.answer < q.choices.length, { message: 'La bonne réponse doit faire partie des choix', path: ['answer'] });

export const stepSchema = z.object({
  id,
  type: z.enum(STEP_TYPES),
  label: z.string().trim().min(2).max(200),
  targets: z.array(id).min(1).max(30),
  count: z.number().int().min(1).max(30),
  questions: z.array(questionSchema).max(20).optional(),
}).refine((s) => s.type !== 'quiz' || (s.questions?.length ?? 0) > 0, { message: 'Un quiz comporte au moins une question', path: ['questions'] })
  .refine((s) => s.type === 'quiz' || s.targets.some((t) => isGroupTarget(s.type, t)) || s.count <= s.targets.length, {
    message: 'Le nombre demandé dépasse le nombre de cibles',
    path: ['count'],
  });

// Sans valeur par défaut : avec Zod 4, `.partial()` appliquerait les défauts
// aux champs absents et une modification partielle (PATCH { status }) les
// écraserait. Les défauts ne valent qu'à la création (missionSchema).
const missionFields = z.object({
  slug: id,
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(2).max(4000),
  objective: z.string().trim().min(2).max(1000),
  mode: z.enum(GAME_MODES),
  environment: id,
  steps: z.array(stepSchema).min(1).max(20)
    .refine((steps) => new Set(steps.map((s) => s.id)).size === steps.length, { message: 'Deux étapes portent le même identifiant' }),
  rewardXp: z.number().int().min(0).max(5000),
  badge: z.preprocess((v) => (v === '' ? null : v), id.nullable().optional()),
  communityId: z.preprocess((v) => (v === '' ? null : v), z.string().uuid().nullable().optional()),
  contentRefs: z.array(z.string().trim().min(1).max(200)).max(50),
  status: z.enum(['DRAFT', 'PUBLISHED', 'DISABLED']),
  position: z.number().int().min(0).max(1000),
});

export const missionSchema = missionFields.extend({
  contentRefs: missionFields.shape.contentRefs.default([]),
  position: missionFields.shape.position.default(0),
});

export const missionPatchSchema = missionFields.partial();

export function toMissionData(body) {
  const data = { ...body };
  if (body.steps) data.steps = JSON.stringify(body.steps);
  if (body.contentRefs) data.contentRefs = JSON.stringify(body.contentRefs);
  return data;
}

export function serializeMission(m) {
  return {
    ...m,
    steps: parseJson(m.steps, []),
    contentRefs: parseJson(m.contentRefs, []),
    community: m.community ? { id: m.community.id, name: m.community.name, slug: m.community.slug } : null,
  };
}

// Événements anonymes comptabilisés.
export const GAME_EVENTS = ['session', 'mission_start', 'mission_complete', 'discovery', 'quiz_perfect', 'challenge'];

export const today = () => new Date().toISOString().slice(0, 10);
