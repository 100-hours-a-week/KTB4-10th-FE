import type { GenerationProgress, Job } from '../api/guidebooks.ts'

const stages: { step: GenerationProgress['step']; label: string }[] = [
  { step: 'queued', label: '접수 대기' },
  { step: 'checking', label: '장소 확인' },
  { step: 'arranging', label: '일정 구성' },
  { step: 'writing', label: '내용 작성' },
  { step: 'rendering', label: '최종 정리' },
]

export function GenerationProgressBar({ job }: { job: Job | null }) {
  const steps = job?.job_type === 'REGENERATION'
    ? stages.filter(({ step }) => step !== 'checking')
    : stages
  const step = job?.progress?.step ?? (job?.status === 'PENDING' ? 'queued' : null)
  const index = steps.findIndex((stage) => stage.step === step)
  const current = steps[index]

  return <div className="book-progress">
    <div className="book-progress-heading">
      <span>{current ? current.label : '진행 단계 확인 중'}</span>
      <span>{current ? `${index + 1} / ${steps.length} 단계` : '진행 정보 기다리는 중'}</span>
    </div>
    <div
      className={`book-progress-track${current ? '' : ' book-progress-track--waiting'}`}
      role="progressbar"
      aria-label="가이드북 생성 단계"
      aria-valuemin={0}
      aria-valuemax={steps.length}
      aria-valuenow={current ? index + 1 : undefined}
      aria-valuetext={current ? `${current.label}, ${index + 1} / ${steps.length} 단계` : '현재 진행 정보를 기다리고 있어요.'}
    >
      {current && <div className="book-progress-fill" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />}
    </div>
    <ol className="book-progress-stages" aria-label="가이드북 생성 순서">
      {steps.map((stage, stageIndex) => <li
        key={stage.step}
        className={stageIndex === index ? 'book-progress-stage--current' : stageIndex < index ? 'book-progress-stage--done' : ''}
        aria-current={stageIndex === index ? 'step' : undefined}
      >{stage.label}</li>)}
    </ol>
  </div>
}
