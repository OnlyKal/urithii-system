import { ArrowLeft, Compass, Play } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Ambience } from '../audio/ambience.js'
import { contentName } from '../core/content.js'
import { fetchMissions } from '../core/gameApi.js'
import { currentStep, pendingTargets } from '../core/missions.js'
import { loadPlatform, rootCategory } from '../core/platform.js'
import { completeQuiz, onNotice, record, recordFreeQuiz, savePlayer, startMission, startSession, updateProfile, updateSettings, useProgress } from '../core/progress.js'
import { atlasQuestions, mixedQuestions } from '../core/quizGen.js'
import { AVATARS } from '../hd/assets.js'
import { createInput } from '../engine/input.js'
import { QUALITY, resolveQuality } from '../engine/quality.js'
import { createRuntime } from '../engine/runtime.js'
import { STAGES } from '../engine/stages.js'
import { g } from '../i18n.js'
import { Dialogue, IdentifyChoice, NatureCard, Quiz, RewardScreen } from '../ui/Dialogs.jsx'
import { CommunitiesWindow, CommunityWindow, CultureCard, ItemCard, ItemsWindow, MediathequeWindow, PanoramaWindow, SavoirsWindow } from '../ui/Platform.jsx'
import { HudButtons, InteractPrompt, Minimap, MissionTracker, Notices, PlayerBadge, ZoneBanner } from '../ui/Hud.jsx'
import { LoadingScreen } from '../ui/LoadingScreen.jsx'
import { Controls, Inventory, Journal, MapPanel, PauseMenu } from '../ui/Panels.jsx'
import { TouchControls } from '../ui/TouchControls.jsx'
import { ENVIRONMENT, riverX, SPAWN, ZONES, zoneAt } from '../world/ituri/catalog.js'
import { buildLayout, colliderGrid } from '../world/ituri/layout.js'
import '../games.css'

// Partie en cours : « URITHI – Les Gardiens de l'Héritage ».
// La scène 3D (Three.js) n'est téléchargée qu'à l'ouverture de cette page.
const GameScene = lazy(() => import('../engine/GameScene.jsx'))

const touchDevice = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches

let noticeKey = 0

export default function GardiensPage() {
  const progress = useProgress()
  const quality = resolveQuality(progress.settings.quality)
  const layout = useMemo(() => buildLayout(QUALITY[quality].density), [quality])
  const queryColliders = useMemo(() => colliderGrid(layout.colliders), [layout])
  const [input] = useState(createInput)
  const [runtime] = useState(() => createRuntime({ queryColliders, spawn: progress.player ?? SPAWN, callbacks: {} }))
  const [stageInfo, setStageInfo] = useState({ quality, stage: 0 })
  const stage = stageInfo.quality === quality ? stageInfo.stage : 0
  const ready = stage >= STAGES.length
  const [phase, setPhase] = useState('briefing')
  const [missions, setMissions] = useState([])
  const [missionError, setMissionError] = useState(false)
  const [panel, setPanel] = useState(null)
  const [near, setNear] = useState(null)
  const [zone, setZone] = useState(null)
  const [notices, setNotices] = useState([])
  const [rewards, setRewards] = useState([])
  const ambience = useRef(null)
  const latest = useRef({})

  const activeMission = missions.find((m) => m.slug === progress.activeMission) ?? null
  const discovered = useMemo(() => ({ ...progress.discoveries, ...progress.consulted }), [progress.discoveries, progress.consulted])
  // Quiz proposé par un personnage : étape en cours de la mission active.
  const activeStep = activeMission ? currentStep(activeMission, progress) : null
  const quizFor = (npcId) => (activeStep?.type === 'quiz' && activeStep.targets.includes(npcId) ? { mission: activeMission, step: activeStep } : null)
  const targets = useMemo(() => (activeMission ? pendingTargets(activeMission, progress) : []), [activeMission, progress])

  useEffect(() => {
    runtime.queryColliders = queryColliders
  }, [runtime, queryColliders])
  // Outil de mise au point (développement uniquement).
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__urithiGame = runtime
    return () => delete window.__urithiGame
  }, [runtime])
  useEffect(() => input.attach(), [input])

  // Registre de la plateforme (référentiel, communautés, langues, lieux).
  useEffect(() => {
    loadPlatform().catch(() => {})
  }, [])

  // Missions publiées ; la première mission non terminée démarre d'elle-même.
  useEffect(() => {
    let alive = true
    fetchMissions()
      .then((list) => alive && setMissions(list))
      .catch(() => alive && setMissionError(true))
    return () => {
      alive = false
    }
  }, [])
  useEffect(() => {
    if (!missions.length || progress.activeMission) return
    const next = missions.find((m) => progress.missions[m.slug]?.status !== 'done')
    if (next && !Object.keys(progress.missions).length) startMission(next)
  }, [missions, progress.activeMission, progress.missions])

  // Marqueurs : cibles de la mission en cours et éléments déjà découverts.
  useEffect(() => {
    runtime.targets = new Set(targets)
    runtime.done = new Set([...Object.keys(progress.discoveries), ...Object.keys(progress.consulted), ...Object.keys(progress.talks)])
  }, [runtime, targets, progress.discoveries, progress.consulted, progress.talks])

  const paused = !ready || phase !== 'playing' || Boolean(panel)
  useEffect(() => {
    runtime.paused = paused
    if (paused) input.reset()
  }, [runtime, input, paused])

  const pushNotice = useCallback((notice) => {
    const key = ++noticeKey
    setNotices((list) => [...list.slice(-3), { ...notice, key }])
    setTimeout(() => setNotices((list) => list.filter((n) => n.key !== key)), 3400)
  }, [])

  // Récompenses et notifications de la progression.
  useEffect(
    () =>
      onNotice((notice) => {
        if (notice.type === 'mission') {
          ambience.current?.chime('mission')
          setRewards((list) => [...list, notice])
        } else {
          if (notice.type === 'trophy' || notice.type === 'level') ambience.current?.chime('correct')
          pushNotice(notice)
        }
      }),
    [pushNotice],
  )
  // Une récompense s'affiche dès qu'aucune fenêtre n'est ouverte.
  useEffect(() => {
    if (panel || !rewards.length || phase !== 'playing') return
    const [first, ...rest] = rewards
    setRewards(rest)
    setPanel({ ...first, type: 'reward' })
  }, [panel, rewards, phase])

  const close = useCallback(() => {
    runtime.talking = null
    setPanel(null)
  }, [runtime])

  // Interaction avec l'élément le plus proche.
  const interact = useCallback(
    (it) => {
      if (!it) return
      const list = latest.current.missions
      const progressNow = latest.current.progress
      if (it.kind === 'plant') {
        if (progressNow.discoveries[it.id]) setPanel({ type: 'card', id: it.id })
        else setPanel({ type: 'identify', id: it.id })
      } else if (it.kind === 'animal') {
        const first = record({ type: 'discover', id: it.id, name: contentName(it.id) }, list)
        if (first) ambience.current?.chime('discover')
        setPanel({ type: 'card', id: it.id, status: first ? g('animalObserve') : null })
      } else if (it.kind === 'npc') {
        runtime.talking = it.id
        const mission = list.find((m) => m.slug === progressNow.activeMission)
        const step = mission && currentStep(mission, progressNow)
        const quiz = step?.type === 'quiz' && step.targets.includes(it.id) ? { mission, step } : null
        // Récit déjà entendu : on passe directement aux questions.
        if (quiz && progressNow.talks[it.id]) setPanel({ type: 'quiz', ...quiz, npc: it.npc })
        else setPanel({ type: 'dialogue', npc: it.npc })
      } else if (it.kind === 'trace') {
        // Borne d'observation d'une fiche de l'atlas sans modèle 3D.
        if (it.traceKind === 'plant') {
          if (progressNow.discoveries[it.id]) setPanel({ type: 'card', id: it.id })
          else setPanel({ type: 'identify', id: it.id })
        } else {
          const first = record({ type: 'discover', id: it.id, name: contentName(it.id) }, list)
          if (first) ambience.current?.chime('discover')
          setPanel({ type: 'card', id: it.id, status: first ? g('pf.traceObservee') : null })
        }
      } else if (it.kind === 'panorama') {
        ambience.current?.chime('open')
        setPanel({ type: 'panorama' })
      } else if (it.kind === 'station') {
        if (record({ type: 'consult', id: it.id, name: it.station.name }, list)) ambience.current?.chime('open')
        const hub = { savoirs: 'savoirs', communautes: 'communities', mediatheque: 'mediatheque' }[it.station.kind]
        setPanel(hub ? { type: hub } : { type: 'culture', station: it.station })
      }
    },
    [runtime],
  )

  useEffect(() => {
    latest.current = { missions, progress, interact }
  })

  // Navigation entre fenêtres : chaque fenêtre ouverte depuis une autre
  // garde un bouton de retour.
  const open = useCallback((next) => setPanel((current) => ({ ...next, back: current })), [])
  const back = panel?.back ? () => setPanel(panel.back) : undefined
  const openItem = useCallback((slug) => open({ type: 'item', slug }), [open])
  const openItems = useCallback((title, eyebrow, params) => open({ type: 'items', title, eyebrow, params }), [open])
  const onReadItem = useCallback(
    (item) =>
      record(
        {
          type: 'read',
          id: item.slug,
          name: item.title,
          data: { category: item.category?.slug ?? null, root: item.category ? rootCategory(item.category.slug) : null, communities: item.communities.map((c) => c.slug).filter(Boolean) },
        },
        latest.current.missions,
      ) && ambience.current?.chime('open'),
    [],
  )
  // Questions tirées des fiches, proposées par les personnages hors mission.
  const freeQuiz = useCallback(
    async (npc) => {
      const questions = npc.id === 'ecogarde' ? atlasQuestions(5, { categories: ['faune', 'flore'] }) : await mixedQuestions(5, { culture: 0.8 })
      if (!questions.length) return
      setPanel({ type: 'freequiz', npc, step: { id: 'libre', label: g('pf.quizLibre', { name: npc.name }), questions } })
    },
    [],
  )

  // Rappels du moteur vers l'interface.
  useEffect(() => {
    const fled = {}
    runtime.callbacks = {
      onZone: (id) => {
        const info = ZONES.find((z) => z.id === id)
        setZone(info)
        record({ type: 'zone', id, name: info.name }, latest.current.missions)
      },
      onNear: setNear,
      onInteract: (it) => latest.current.interact(it),
      onStep: (water) => ambience.current?.step(water),
      onPosition: (pos) => ambience.current?.setPlace(zoneAt(pos.x, pos.z), Math.abs(pos.x - riverX(pos.z))),
      onSave: (player, extra) => savePlayer(player, extra),
      onAnimalFlee: (id) => {
        const now = Date.now()
        if (now - (fled[id] ?? 0) < 8000) return
        fled[id] = now
        pushNotice({ type: 'info', text: g('animalFuit', { name: contentName(id) }) })
      },
    }
  }, [runtime, pushNotice])

  useEffect(() => {
    if (!zone) return
    const id = setTimeout(() => setZone(null), 3800)
    return () => clearTimeout(id)
  }, [zone])

  // Raccourcis clavier des panneaux.
  useEffect(() => {
    if (phase !== 'playing') return
    const onKey = (e) => {
      if (e.target.closest?.('input, select, textarea')) return
      const key = e.key.toLowerCase()
      if (key === 'escape') {
        if (!panel) setPanel({ type: 'pause' })
        return
      }
      if (panel && !['map', 'journal', 'inventory'].includes(panel.type)) return
      const type = { m: 'map', j: 'journal', i: 'inventory' }[key]
      if (!type) return
      setPanel(panel?.type === type ? null : { type })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, panel])

  // Son : démarré au premier clic (exigence des navigateurs), suspendu
  // lorsque l'onglet est masqué.
  useEffect(() => {
    const onVisibility = () => (document.hidden ? ambience.current?.pause() : ambience.current?.resume())
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      ambience.current?.stop()
    }
  }, [])
  useEffect(() => {
    ambience.current?.setSound(progress.settings.sound)
    ambience.current?.setMusic(progress.settings.music)
  }, [progress.settings.sound, progress.settings.music])

  const play = () => {
    if (!ambience.current) {
      ambience.current = new Ambience()
      ambience.current.start({ sound: progress.settings.sound, music: progress.settings.music })
    }
    startSession()
    setPhase('playing')
  }

  const onStage = useCallback((n) => setStageInfo({ quality, stage: n }), [quality])

  return (
    <div className={`game-root ${touchDevice ? 'is-touch' : ''}`}>
      <Suspense fallback={null}>
        <GameScene key={quality} quality={quality} runtime={runtime} input={input} layout={layout} stage={stage} onStage={onStage} outfit={{ skin: '#5c3b22', shirt: '#2f6f8f', pants: '#3b3a36', shoes: '#4a3424' }} avatar={progress.profile.avatar ?? 'joueur'} />
      </Suspense>

      {!ready && <LoadingScreen stage={stage} />}

      {ready && phase === 'briefing' && (
        <div className="game-briefing">
          <div className="game-briefing-card">
            <Link to="/jeux" className="game-back">
              <ArrowLeft size={16} aria-hidden="true" /> {g('retourJeux')}
            </Link>
            <span className="game-eyebrow">
              <Compass size={14} aria-hidden="true" /> {ENVIRONMENT.name}
            </span>
            <h1>{progress.profile.name ? g('bienvenueNom', { name: progress.profile.name }) : g('bienvenue')}</h1>
            <p>{ENVIRONMENT.description}</p>
            {activeMission && (
              <div className="game-briefing-mission">
                <small>{g('missionEnCours')}</small>
                <strong>{activeMission.title}</strong>
                <p>{activeMission.objective}</p>
              </div>
            )}
            {quality === 'high' && (
              <div className="game-avatar-choice" role="radiogroup" aria-label={g('avatar')}>
                <small>{g('avatar')}</small>
                {AVATARS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={(progress.profile.avatar ?? 'joueur') === a}
                    className={`game-button ghost ${(progress.profile.avatar ?? 'joueur') === a ? 'is-active' : ''}`}
                    onClick={() => updateProfile({ avatar: a })}
                  >
                    {g(`avatar_${a}`)}
                  </button>
                ))}
              </div>
            )}
            <details className="game-briefing-controls">
              <summary>{g('commandes')}</summary>
              <Controls />
            </details>
            <p className="game-note">{g('noteFidelite')}</p>
            <button type="button" className="game-button big" onClick={play} autoFocus>
              <Play size={18} aria-hidden="true" /> {g('jouer')}
            </button>
          </div>
        </div>
      )}

      {ready && phase === 'playing' && (
        <div className="game-hud">
          <div className="hud-top-left">
            <PlayerBadge progress={progress} />
            <MissionTracker mission={activeMission} progress={progress} onOpen={() => setPanel({ type: 'journal' })} />
          </div>
          <div className="hud-top-right">
            <Minimap runtime={runtime} targets={targets} discovered={discovered} onOpen={() => setPanel({ type: 'map' })} />
            <HudButtons
              onMap={() => setPanel({ type: 'map' })}
              onJournal={() => setPanel({ type: 'journal' })}
              onInventory={() => setPanel({ type: 'inventory' })}
              onPause={() => setPanel({ type: 'pause' })}
              sound={progress.settings.sound}
              onSound={() => updateSettings({ sound: !progress.settings.sound, music: !progress.settings.sound })}
            />
          </div>
          <ZoneBanner zone={zone} />
          <Notices notices={notices} />
          {!panel && <InteractPrompt target={near} discovered={discovered} onInteract={() => interact(near)} />}
          {touchDevice && !panel && <TouchControls input={input} canInteract={Boolean(near)} onInteract={() => interact(near)} />}
        </div>
      )}

      {panel?.type === 'journal' && (
        <Journal
          missions={missions}
          progress={progress}
          error={missionError}
          onStart={(m) => {
            startMission(m)
            close()
          }}
          onClose={close}
        />
      )}
      {panel?.type === 'inventory' && (
        <Inventory progress={progress} onOpenCard={(id) => open({ type: 'card', id })} onOpenItem={openItem} onOpenCommunity={(slug) => open({ type: 'community', slug })} onClose={close} />
      )}
      {panel?.type === 'map' && <MapPanel runtime={runtime} targets={targets} discovered={discovered} onClose={close} />}
      {panel?.type === 'pause' && <PauseMenu settings={progress.settings} quality={quality} onSettings={updateSettings} onResume={close} onClose={close} />}
      {panel?.type === 'card' && <NatureCard id={panel.id} status={panel.status} onBack={back} onClose={close} />}
      {panel?.type === 'identify' && (
        <IdentifyChoice
          id={panel.id}
          onClose={close}
          onSuccess={() => {
            record({ type: 'identify', id: panel.id, name: contentName(panel.id) }, missions)
            ambience.current?.chime('discover')
            setPanel({ type: 'card', id: panel.id, status: g('especeIdentifiee') })
          }}
        />
      )}
      {panel?.type === 'culture' && (
        <CultureCard
          station={panel.station}
          read={progress.reads}
          onOpenItem={openItem}
          onOpenLanguage={(l) => openItems(l.name, g('pf.langue'), { languageId: l.id })}
          onBack={back}
          onClose={close}
        />
      )}
      {panel?.type === 'items' && <ItemsWindow title={panel.title} eyebrow={panel.eyebrow} params={panel.params} read={progress.reads} onOpenItem={openItem} onBack={back} onClose={close} />}
      {panel?.type === 'item' && <ItemCard slug={panel.slug} onRead={onReadItem} onOpenItem={openItem} onBack={back} onClose={close} />}
      {panel?.type === 'savoirs' && (
        <SavoirsWindow onOpenTheme={(c) => open({ type: 'culture', station: { id: `theme-${c.slug}`, name: c.name, theme: c.name, category: c.slug } })} onClose={close} />
      )}
      {panel?.type === 'communities' && (
        <CommunitiesWindow
          met={progress.communities}
          onOpenCommunity={(slug) => open({ type: 'community', slug })}
          onOpenPlace={(p) => openItems(p.name, g('pf.province'), { placeId: p.id })}
          onOpenLanguage={(l) => openItems(l.name, g('pf.langue'), { languageId: l.id })}
          onClose={close}
        />
      )}
      {panel?.type === 'community' && (
        <CommunityWindow
          slug={panel.slug}
          onMeet={(c) => record({ type: 'community', id: panel.slug, name: c.name }, latest.current.missions) && ambience.current?.chime('discover')}
          onOpenItem={openItem}
          onBack={back}
          onClose={close}
        />
      )}
      {panel?.type === 'mediatheque' && <MediathequeWindow onOpenItem={openItem} onClose={close} />}
      {panel?.type === 'panorama' && (
        <PanoramaWindow
          discoveries={progress.discoveries}
          onOpenCard={(id) => open({ type: 'card', id })}
          onOpenLandscape={(p) => {
            if (record({ type: 'discover', id: p.id, name: p.name, kind: 'paysage' }, latest.current.missions)) ambience.current?.chime('discover')
            open({ type: 'card', id: p.id, status: g('pf.paysageDecouvert') })
          }}
          onClose={close}
        />
      )}
      {panel?.type === 'freequiz' && (
        <Quiz
          step={panel.step}
          sound={(kind) => ambience.current?.chime(kind)}
          onClose={close}
          onDone={(correct, total) => {
            recordFreeQuiz(correct, total)
            close()
          }}
        />
      )}
      {panel?.type === 'dialogue' && (
        <Dialogue
          npc={panel.npc}
          quiz={quizFor(panel.npc.id)}
          onRead={() => record({ type: 'talk', id: panel.npc.id, name: panel.npc.name }, latest.current.missions)}
          onQuiz={() => setPanel({ type: 'quiz', ...quizFor(panel.npc.id), npc: panel.npc })}
          onFreeQuiz={() => freeQuiz(panel.npc)}
          onClose={close}
        />
      )}
      {panel?.type === 'quiz' && (
        <Quiz
          step={panel.step}
          sound={(kind) => ambience.current?.chime(kind)}
          onClose={close}
          onDone={(correct, total) => {
            completeQuiz(panel.mission.slug, panel.step.id, correct, total, missions)
            close()
          }}
        />
      )}
      {panel?.type === 'reward' && <RewardScreen mission={panel.mission} badge={panel.badge} xp={panel.xp} onClose={close} />}
    </div>
  )
}
