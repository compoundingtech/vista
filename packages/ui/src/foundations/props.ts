/**
 * Bridge between StyleX styles and the package's existing `className` escape
 * hatch.
 *
 * Every component here accepts `className`, and 282 story call sites plus six
 * downstream tools pass it. Dropping it in favour of a StyleX-typed prop would
 * be a breaking change to the design system's public API for every consumer at
 * once, which is not something a styling migration should carry. So the prop
 * stays and the generated class is merged with it.
 *
 * The caller's class is appended last. That mirrors what `tailwind-variants`
 * did and keeps the escape hatch's intent, but note the difference: `tv()`
 * resolved conflicts by *removing* the losing utility via tailwind-merge, while
 * here both classes are present and the winner is decided by stylesheet order.
 * For the additive use this hatch actually gets — layout and spacing in stories
 * — the result is the same. For a caller trying to override a colour the
 * component already sets, it is not, and that case needs a real prop instead.
 *
 * @module
 */
import type { CompiledStyles, InlineStyles } from '@stylexjs/stylex'
import * as stylex from '@stylexjs/stylex'
import type { CSSProperties } from 'react'
import type { StyleRenderProps } from 'react-aria-components'

/**
 * React Aria's two render-prop escape hatches, keyed off the one interface it
 * exports rather than restated here.
 *
 * `ClassNameOrFunction` and `StyleOrFunction` are the names upstream uses, but
 * only the first is exported and only from a deep path — so both are derived
 * from `StyleRenderProps`, which the package root does export. Deriving keeps
 * the compiler as the source of truth: if upstream changes either shape, this
 * file changes with it instead of drifting silently.
 *
 * `V` is the component's render-values type (`SwitchRenderProps`,
 * `TableRenderProps`, …). React Aria adds `defaultClassName` / `defaultStyle`
 * to it before calling the function.
 */
type ClassNameOrFunction<V> = NonNullable<StyleRenderProps<V>['className']>
type StyleOrFunction<V> = NonNullable<StyleRenderProps<V>['style']>

/**
 * Props for a DOM element: the compiled StyleX class merged with `className`.
 *
 * Neither key admits an explicit `undefined`. The repo runs with
 * `exactOptionalPropertyTypes`, and React Aria's `className` is
 * `ClassNameOrFunction<…>` with no `undefined` member — so spreading a
 * `string | undefined` into one of its components is a type error rather than
 * a silently-absent prop. Omit the key instead of setting it undefined.
 *
 * `style` is `CSSProperties`, not the `Record<string, string | number>` that
 * `stylex.props` returns. The record is assignable to `CSSProperties`, so
 * nothing is lost going out — but `CSSProperties` is NOT assignable to the
 * record, because `csstype`'s `Properties` has no string index signature. That
 * asymmetry is the whole of the bug this type used to cause: typing the
 * *overrides* as a record rejected every React style object a caller could
 * possibly hand in.
 */
export interface StyledProps {
  readonly className?: string
  readonly style?: CSSProperties
}

/** What a caller may hand through: the escape-hatch class and an inline style. */
export interface StyledOverrides {
  readonly className?: string | undefined
  readonly style?: CSSProperties | undefined
}

/**
 * The same pair in React Aria's render-prop form, for a wrapper that forwards
 * `className` / `style` straight off an `Aria*Props` type.
 */
export interface StyledRenderOverrides<V> {
  readonly className?: ClassNameOrFunction<V> | undefined
  readonly style?: StyleOrFunction<V> | undefined
}

/** Props for a React Aria element: same two keys, either form. */
export interface StyledRenderProps<V> {
  readonly className?: ClassNameOrFunction<V>
  readonly style?: StyleOrFunction<V>
}

/**
 * Concatenate the compiled class with the caller's, tolerating absent or empty
 * on either side.
 *
 * Extracted only because the static and render-prop paths below must apply the
 * identical rule; two copies of "caller last, skip the separator when a side is
 * empty" is exactly the divergence this bridge exists to prevent.
 */
const concatClasses = (
  compiled: string | undefined,
  caller: string | undefined,
): string | undefined =>
  caller === undefined || caller === ''
    ? compiled
    : compiled === undefined || compiled === ''
      ? caller
      : `${compiled} ${caller}`

/**
 * Lay the caller's declarations on top of StyleX's, per property, so the caller
 * overrides what it names and inherits the rest — including StyleX's injected
 * custom properties for dynamic styles.
 *
 * Same reason for existing as `concatClasses`: one precedence rule, two paths.
 */
const overlayStyle = (
  compiled: Readonly<Record<string, string | number>> | undefined,
  caller: CSSProperties | undefined,
): CSSProperties | undefined =>
  caller === undefined ? compiled : compiled === undefined ? caller : { ...compiled, ...caller }

/**
 * Compile `styles`, then merge the caller's `className` and inline `style`.
 *
 * Argument order carries the precedence: later styles win over earlier ones,
 * per property. Where a selected state and a hover state set the same property,
 * pass the selected style later AND restate the hover value in it — nesting
 * does not resolve that, and an attribute-state condition outranks a
 * pseudo-class regardless of authoring order.
 *
 * ## Why this merges `style` instead of leaving it to spread order
 *
 * `stylex.props` returns a `style` object only for **dynamic** styles; for
 * static ones it returns a class alone. That difference is invisible at the
 * call site, and it inverts which JSX spread order is correct:
 *
 * - static styles, `{...styled(…)} {...props}` — props last is REQUIRED, or the
 *   caller's `style` is dropped;
 * - dynamic styles, the same ordering is WRONG — the caller's `style` clobbers
 *   the custom properties StyleX injected, so the dynamic value never applies.
 *
 * No single ordering is safe for both, so ordering is the wrong mechanism. The
 * hazard is not a component that is dynamic today; it is a static component
 * *gaining* a dynamic style later, at which point a correct call site silently
 * becomes wrong with nothing in that diff to explain it. Merging here costs one
 * function and removes the class outright.
 *
 * Pass the caller's overrides in and do NOT also spread them onto the element:
 *
 * ```tsx
 * const { style, ...rest } = props
 * <El {...styled({ className, style }, styles.root)} {...rest} />
 * ```
 *
 * The caller wins on any property it names, which is what an escape hatch is
 * for. StyleX keeps everything the caller did not mention, including its
 * injected variables.
 *
 * A component with no styling of its own should not call this at all —
 * `Chat/icons.tsx` is left unconverted for exactly that reason.
 *
 * ## Why there are two overloads
 *
 * A React Aria wrapper that forwards `className` / `style` straight off its
 * `Aria*Props` type is handing in `ClassNameOrFunction<V>` and
 * `StyleOrFunction<V>` — either a value or a **function of the render state**.
 * A function cannot be merged here, because the render state does not exist
 * until React Aria calls it. So when the caller passes one, the merge is
 * deferred: this returns a function of its own that calls the caller's and
 * concatenates the compiled class, exactly as React Aria's own
 * `composeRenderProps` does. The runtime rule is identical in both forms —
 * caller last, per property.
 *
 * The overloads exist so the *return* type follows the input. A function-valued
 * `className` is meaningless on a plain `<div>`, so the static overload keeps
 * returning plain strings and objects; only a caller that hands in a render
 * prop gets one back. A static wrapper that later widens its props to the React
 * Aria form therefore fails to compile at the plain element, which is where the
 * mistake is, rather than shipping a function into a DOM attribute.
 */
/**
 * One style argument {@link styled} forwards to `stylex.props`.
 *
 * `StyleXStyles` is the *authored* shape — what annotations hold
 * (`Record<Size, stylex.StyleXStyles>`, the `stylexStyle` prop). A style
 * whose declarations nest conditions (a hover state inside
 * `@media (hover: hover)`) only type-checks in the *compiled* shape
 * `stylex.create` returns: the authored mapping cannot express the nested
 * condition, so a rest parameter of `StyleXStyles` alone rejects values
 * `stylex.create` itself produced. Take the union so authored annotations and
 * raw `create()` results both pass through to `stylex.props`, which accepts
 * exactly this set.
 */
type StyleXStyleArg =
  | stylex.StyleXStyles
  | CompiledStyles
  | Readonly<[CompiledStyles, InlineStyles]>

export function styled(
  overrides: StyledOverrides | string | undefined,
  ...styles: readonly StyleXStyleArg[]
): StyledProps
export function styled<V>(
  overrides: StyledRenderOverrides<V>,
  ...styles: readonly StyleXStyleArg[]
): StyledRenderProps<V>
export function styled<V>(
  overrides: StyledRenderOverrides<V> | string | undefined,
  ...styles: readonly StyleXStyleArg[]
): StyledRenderProps<V> {
  const { className, style } =
    typeof overrides === 'string' ? { className: overrides, style: undefined } : (overrides ?? {})

  const compiled = stylex.props(...styles)

  // A render-prop caller defers both merges to React Aria's call. `?? ''` is
  // needed because `ClassNameOrFunction` promises a `string`, not an optional
  // one, and a component with neither a compiled class nor a caller class has
  // no class at all.
  const mergedClass =
    typeof className === 'function'
      ? (values: Parameters<typeof className>[0]) =>
          concatClasses(compiled.className, className(values)) ?? ''
      : concatClasses(compiled.className, className)

  const mergedStyle =
    typeof style === 'function'
      ? (values: Parameters<typeof style>[0]) => overlayStyle(compiled.style, style(values))
      : overlayStyle(compiled.style, style)

  return {
    ...(mergedClass === undefined ? {} : { className: mergedClass }),
    ...(mergedStyle === undefined ? {} : { style: mergedStyle }),
  }
}
