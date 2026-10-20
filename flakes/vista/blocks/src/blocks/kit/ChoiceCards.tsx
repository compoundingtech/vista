import * as stylex from '@stylexjs/stylex'
import { tokens } from '@vista/ui/tokens.stylex'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button, Checkbox, CheckboxGroup, Radio, RadioGroup } from 'react-aria-components'

import { Ask } from '../../authoring.tsx'
import { Icon } from './icons.tsx'
import { Mark } from './Mark.tsx'

/** One bounded option. `cost`, `next` and `risk` are one short line each; `detail` is free content. */
export interface Choice {
  readonly id: string
  readonly label: string
  readonly cost?: ReactNode
  readonly next?: ReactNode
  readonly risk?: ReactNode
  readonly recommended?: boolean
  readonly detail?: ReactNode
}

/**
 * Props for ChoiceCards. `id` names the ask and prefixes the copied answer (`id=choice`);
 * `multiple` turns single choice into a pick list with a sticky dock.
 */
export interface ChoiceCardsProps {
  readonly id: string
  /** Question shown as the ask's heading and used as the group's accessible name. */
  readonly label?: string
  readonly options: readonly Choice[]
  readonly multiple?: boolean
}

/**
 * A registered ask answered with real controls (MED.DOC.TASTE-R06). Single choice renders radio
 * cards and one Copy answer action; `multiple` renders checkbox cards and a sticky dock with
 * the count, a copyable pick string, a Recommended preset and reset. The recommended mark is a
 * quiet line and never resembles the selected state. Copying marks the ask answered for the
 * shell's counter.
 */
export const ChoiceCards = ({ id, label, options, multiple = false }: ChoiceCardsProps) => (
  <Ask id={id} {...(label === undefined ? {} : { label })}>
    {multiple ? (
      <PickList id={id} label={label} options={options} />
    ) : (
      <SingleChoice id={id} label={label} options={options} />
    )}
  </Ask>
)

type ChoiceListProps = Omit<ChoiceCardsProps, 'multiple' | 'label'> & {
  readonly label: string | undefined
}

type CopyState = 'idle' | 'copied' | 'manual'

/** Shared copy feedback: only a confirmed clipboard write completes the ask. */
export const CopyOutcome = ({ state }: { readonly state: CopyState }) => (
  <span role="status" aria-live="polite" data-vista-answered={state === 'copied' ? '' : undefined}>
    {state === 'copied' ? 'Copied' : state === 'manual' ? 'Copy failed' : ''}
  </span>
)

/** Clipboard copy that falls back to selecting the text when the clipboard is unavailable. */
const useCopy = (text: string) => {
  const [state, setState] = useState<CopyState>('idle')
  const field = useRef<HTMLInputElement | null>(null)
  useEffect(() => setState('idle'), [text])
  useEffect(() => {
    if (state === 'manual') field.current?.select()
  }, [state])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('manual')
    }
  }
  return { state, copy, field }
}

const SingleChoice = ({ id, label, options }: ChoiceListProps) => {
  const [value, setValue] = useState('')
  const answer = `${id}=${value}`
  const { state, copy, field } = useCopy(answer)
  return (
    <div {...stylex.props(styles.root)} data-vista-tones="">
      <RadioGroup
        {...stylex.props(styles.cards)}
        value={value}
        onChange={setValue}
        aria-label={label ?? id}
      >
        {options.map((option) => (
          <Radio key={option.id} value={option.id} {...stylex.props(styles.card)}>
            {({ isSelected, isFocusVisible }) => (
              <CardBody
                option={option}
                selected={isSelected}
                focused={isFocusVisible}
                indicator="radio"
              />
            )}
          </Radio>
        ))}
      </RadioGroup>
      <div {...stylex.props(styles.answer)}>
        <Button
          {...stylex.props(styles.button, styles.primary)}
          isDisabled={value === ''}
          onPress={copy}
        >
          <Icon name={state === 'copied' ? 'check' : 'copy'} size={14} />
          {state === 'copied' ? 'Copied' : 'Copy answer'}
        </Button>
        {state === 'manual' ? (
          <input
            ref={field}
            {...stylex.props(styles.string)}
            readOnly
            value={answer}
            aria-label="Answer"
          />
        ) : null}
      </div>
      <CopyOutcome state={state} />
    </div>
  )
}

const PickList = ({ id, label, options }: ChoiceListProps) => {
  const [picked, setPicked] = useState<readonly string[]>([])
  const recommended = options
    .filter((option) => option.recommended === true)
    .map((option) => option.id)
  const answer = `${id}=${options
    .filter((option) => picked.includes(option.id))
    .map((option) => option.id)
    .join(',')}`
  const { state, copy, field } = useCopy(answer)
  return (
    <div {...stylex.props(styles.root)} data-vista-tones="">
      <CheckboxGroup
        {...stylex.props(styles.cards, styles.pickCards)}
        value={[...picked]}
        onChange={setPicked}
        aria-label={label ?? id}
      >
        {options.map((option) => (
          <div key={option.id} id={`${id}-${option.id}`} {...stylex.props(styles.anchor)}>
            <Checkbox value={option.id} {...stylex.props(styles.card)}>
              {({ isSelected, isFocusVisible }) => (
                <CardBody
                  option={option}
                  selected={isSelected}
                  focused={isFocusVisible}
                  indicator="checkbox"
                />
              )}
            </Checkbox>
          </div>
        ))}
      </CheckboxGroup>
      <div {...stylex.props(styles.dock)} role="region" aria-label="Your pick">
        <span {...stylex.props(styles.count)} role="status">
          <strong {...stylex.props(styles.countNumber)}>{picked.length}</strong> of {options.length}
        </span>
        <span {...stylex.props(styles.ticks)} aria-hidden="true">
          {options.map((option) => (
            <a
              key={option.id}
              href={`#${id}-${option.id}`}
              tabIndex={-1}
              title={option.label}
              {...stylex.props(
                styles.tickMark,
                option.recommended === true && styles.tickRecommended,
                picked.includes(option.id) && styles.tickPicked,
              )}
            />
          ))}
        </span>
        <input
          ref={field}
          {...stylex.props(styles.string, styles.dockString)}
          readOnly
          value={answer}
          aria-label="Pick string"
          onFocus={(event) => event.currentTarget.select()}
        />
        {recommended.length > 0 ? (
          <Button
            {...stylex.props(styles.button, styles.quiet)}
            onPress={() => setPicked(recommended)}
          >
            <span {...stylex.props(styles.recommendInk)}>
              <Icon name="thumbs-up" size={14} />
            </span>
            Recommended
          </Button>
        ) : null}
        {picked.length > 0 ? (
          <Button
            {...stylex.props(styles.button, styles.quiet)}
            aria-label="Clear picks"
            onPress={() => setPicked([])}
          >
            <Icon name="rotate-ccw" size={14} />
          </Button>
        ) : null}
        <Button
          {...stylex.props(styles.button, styles.primary)}
          isDisabled={picked.length === 0}
          onPress={copy}
        >
          <Icon name={state === 'copied' ? 'check' : 'copy'} size={14} />
          {state === 'copied' ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <CopyOutcome state={state} />
    </div>
  )
}

const CardBody = ({
  option,
  selected,
  focused,
  indicator,
}: {
  readonly option: Choice
  readonly selected: boolean
  readonly focused: boolean
  readonly indicator: 'radio' | 'checkbox'
}) => (
  <span {...stylex.props(styles.body, selected && styles.selected, focused && styles.focused)}>
    <span {...stylex.props(styles.head)}>
      <span {...stylex.props(styles.label)}>{option.label}</span>
      <span
        {...stylex.props(
          indicator === 'radio' ? styles.radio : styles.checkbox,
          selected && (indicator === 'radio' ? styles.radioOn : styles.checkboxOn),
        )}
        aria-hidden="true"
      >
        {indicator === 'checkbox' && selected ? (
          <Icon name="check" size={12} strokeWidth={3} />
        ) : null}
      </span>
    </span>
    {option.recommended === true ? <Mark tone="recommend" /> : null}
    {option.cost === undefined && option.next === undefined && option.risk === undefined ? null : (
      <span {...stylex.props(styles.lines)}>
        {option.cost === undefined ? null : (
          <span {...stylex.props(styles.line)}>
            <Icon name="coins" size={13} aria-label="Cost" />
            {option.cost}
          </span>
        )}
        {option.next === undefined ? null : (
          <span {...stylex.props(styles.line)}>
            <Icon name="arrow-right" size={13} aria-label="Next" />
            {option.next}
          </span>
        )}
        {option.risk === undefined ? null : (
          <span {...stylex.props(styles.line, styles.risk)}>
            <Icon name="triangle-alert" size={13} aria-label="Risk" />
            {option.risk}
          </span>
        )}
      </span>
    )}
    {option.detail === undefined ? null : (
      <span {...stylex.props(styles.detail)}>{option.detail}</span>
    )}
  </span>
)

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.875rem',
    color: tokens['--ds-gray-1000'],
  },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))',
    gap: '0.625rem',
  },
  pickCards: {
    gridTemplateColumns: '1fr',
  },
  anchor: {
    scrollMarginTop: '5rem',
  },
  card: {
    display: 'flex',
    cursor: 'pointer',
    outline: 'none',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.5rem',
    width: '100%',
    paddingBlock: '0.875rem 1rem',
    paddingInline: '1rem',
    borderRadius: '0.625rem',
    backgroundColor: {
      default: tokens['--ds-background-100'],
      ':hover': tokens['--ds-gray-alpha-100'],
    },
    boxShadow: `inset 0 0 0 1px ${tokens['--ds-gray-alpha-400']}`,
    transitionProperty: 'box-shadow, background-color',
    transitionDuration: '120ms',
  },
  selected: {
    boxShadow: `inset 0 0 0 2px ${tokens['--ds-gray-1000']}`,
  },
  focused: {
    outline: `2px solid ${tokens['--ds-focus-color']}`,
    outlineOffset: '2px',
  },
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.75rem',
    width: '100%',
  },
  label: {
    fontSize: '0.9375rem',
    lineHeight: '1.3rem',
    fontWeight: 600,
  },
  radio: {
    flex: 'none',
    width: '1.125rem',
    height: '1.125rem',
    marginTop: '0.1rem',
    borderRadius: '50%',
    boxShadow: `inset 0 0 0 1.5px ${tokens['--ds-gray-alpha-600']}`,
  },
  radioOn: {
    boxShadow: `inset 0 0 0 5px ${tokens['--ds-gray-1000']}`,
  },
  checkbox: {
    flex: 'none',
    display: 'grid',
    placeItems: 'center',
    width: '1.125rem',
    height: '1.125rem',
    marginTop: '0.1rem',
    borderRadius: '0.3rem',
    boxShadow: `inset 0 0 0 1.5px ${tokens['--ds-gray-alpha-600']}`,
  },
  checkboxOn: {
    backgroundColor: tokens['--ds-gray-1000'],
    color: tokens['--ds-background-100'],
    boxShadow: 'none',
  },
  lines: {
    display: 'grid',
    gap: '0.25rem',
  },
  line: {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '0.4rem',
    fontSize: '0.8125rem',
    lineHeight: '1.2rem',
    color: tokens['--ds-gray-900'],
  },
  risk: {
    color: 'var(--tone-risk-ink)',
  },
  detail: {
    display: 'block',
    width: '100%',
    fontSize: '0.8125rem',
  },
  answer: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.625rem',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    height: '2.125rem',
    paddingInline: '0.75rem',
    borderWidth: 0,
    borderRadius: '0.45rem',
    font: 'inherit',
    fontSize: '0.8125rem',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    outline: {
      default: 'none',
      ':focus-visible': `2px solid ${tokens['--ds-focus-color']}`,
    },
    outlineOffset: '2px',
  },
  primary: {
    paddingInline: '1rem',
    backgroundColor: {
      default: tokens['--ds-gray-1000'],
      ':disabled': tokens['--ds-gray-alpha-200'],
    },
    color: {
      default: tokens['--ds-background-100'],
      ':disabled': tokens['--ds-gray-800'],
    },
    cursor: { default: 'pointer', ':disabled': 'default' },
  },
  quiet: {
    backgroundColor: {
      default: 'transparent',
      ':hover': tokens['--ds-gray-alpha-100'],
    },
    color: tokens['--ds-gray-900'],
  },
  recommendInk: {
    display: 'inline-flex',
    color: 'var(--tone-recommend-ink)',
  },
  string: {
    minWidth: 0,
    height: '2.125rem',
    paddingInline: '0.625rem',
    borderWidth: 0,
    borderRadius: '0.45rem',
    backgroundColor: tokens['--ds-gray-alpha-100'],
    color: tokens['--ds-gray-1000'],
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    fontSize: '0.78rem',
    outline: {
      default: 'none',
      ':focus-visible': `2px solid ${tokens['--ds-focus-color']}`,
    },
    textOverflow: 'ellipsis',
  },
  dockString: {
    flex: '1 1 12rem',
  },
  dock: {
    position: 'sticky',
    bottom: '1rem',
    zIndex: 5,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.625rem',
    paddingBlock: '0.625rem',
    paddingInline: '1.125rem 0.625rem',
    borderRadius: '0.75rem',
    backgroundColor: `color-mix(in oklab, ${tokens['--ds-background-100']} 92%, transparent)`,
    backdropFilter: 'blur(10px)',
    boxShadow: `inset 0 0 0 1px ${tokens['--ds-gray-alpha-400']}, 0 8px 24px -8px rgb(0 0 0 / 0.25)`,
  },
  count: {
    fontSize: '0.8125rem',
    color: tokens['--ds-gray-900'],
    whiteSpace: 'nowrap',
  },
  countNumber: {
    fontSize: '0.9375rem',
    color: tokens['--ds-gray-1000'],
  },
  ticks: {
    display: { default: 'flex', '@media (max-width: 40rem)': 'none' },
    gap: '3px',
    alignItems: 'center',
  },
  tickMark: {
    display: 'block',
    width: '6px',
    height: '16px',
    borderRadius: '2px',
    backgroundColor: tokens['--ds-gray-alpha-300'],
  },
  tickRecommended: {
    boxShadow: 'inset 0 -3px 0 var(--tone-recommend-line)',
  },
  tickPicked: {
    backgroundColor: tokens['--ds-gray-1000'],
    boxShadow: 'none',
  },
})
