/**
 * Compile-time assertions for the `styled()` bridge in `./props.ts`.
 *
 * These are checked by `tsc`, not by a test runner. This package has no unit
 * test config — the only harness is the Storybook story gate, which is a
 * rendering check and cannot see a type. But `check:quick` type-checks
 * `src/**\/*`, so a violated assertion here fails the same gate that a broken
 * component does, which is the property that matters.
 *
 * ## What these guard
 *
 * `styled()` used to type its `style` override as
 * `Readonly<Record<string, string | number>>` — the shape `stylex.props`
 * *returns*. That is the wrong shape for what a caller *hands in*, and the
 * asymmetry is not obvious: the record is assignable to `CSSProperties`, but
 * `CSSProperties` is not assignable to the record, because `csstype`'s
 * `Properties` has no string index signature. So the outgoing direction
 * compiled fine and the incoming direction rejected every React style object
 * in existence, including React Aria's.
 *
 * React Aria makes it worse in a second, independent way: on all 38 components
 * in this package that import `react-aria-components`, `className` and `style`
 * are `ClassNameOrFunction<V>` / `StyleOrFunction<V>` — a value **or a function
 * of the render state**. A wrapper forwarding those off its own `Aria*Props`
 * type could not call `styled()` at all.
 *
 * Both directions are asserted below, because a fix for either one alone would
 * still leave the other failing and the two error messages look alike.
 *
 * @module
 */

import type { CSSProperties } from 'react'
import type { SwitchProps, SwitchRenderProps } from 'react-aria-components'

import {
  styled,
  type StyledProps,
  type StyledRenderOverrides,
  type StyledRenderProps,
} from './props.ts'

/** Fails to compile unless `T` is exactly `true`. */
type Assert<T extends true> = T

/** Wrapped in tuples so a union on either side is compared as a whole. */
type Extends<A, B> = [A] extends [B] ? true : false

/**
 * 0. The reported defect, reproduced as the call that failed.
 *
 * A React Aria wrapper forwarding `className` and `style` off its own props
 * type. Before the fix this produced the two errors verbatim:
 *
 * ```
 * TS2322: 'ClassNameOrFunction<SwitchRenderProps> | undefined' is not
 *         assignable to 'string | undefined'
 * TS2322: 'StyleOrFunction<SwitchRenderProps> | undefined' is not assignable
 *         to 'Readonly<Record<string, string | number>> | undefined'
 *           'CSSProperties' is not assignable to
 *           'Readonly<Record<string, string | number>>'
 *             Index signature for type 'string' is missing in type
 *             'Properties<string | number, string & {}>'
 * ```
 *
 * Unlike the assertions below, this one is a value rather than a type, so it
 * emits a function into `dist`. That is the cost of testing the failure as it
 * was actually reported: the pure-type assertions reduce the call to prop
 * assignability, which is *almost* the same check but does not exercise
 * overload resolution — and picking the wrong overload is the one way the fix
 * could still be wrong while every assertion below passes.
 */
export const ariaOverridesCompile = (props: SwitchProps): StyledRenderProps<SwitchRenderProps> => {
  const { className, style } = props
  return styled<SwitchRenderProps>({ className, style })
}

/**
 * 1. Every value React Aria's `style` prop admits — a `CSSProperties` object
 *    *and* a function of the render state — is an acceptable override.
 *
 * This is the assertion that fails without the fix. Before it, the right-hand
 * side was `Readonly<Record<string, string | number>> | undefined` and neither
 * member of `StyleOrFunction` was assignable to it.
 */
export type AriaStyleIsAcceptable = Assert<
  Extends<SwitchProps['style'], StyledRenderOverrides<SwitchRenderProps>['style']>
>

/** 2. Same for `className`, whose function form is the commoner one upstream. */
export type AriaClassNameIsAcceptable = Assert<
  Extends<SwitchProps['className'], StyledRenderOverrides<SwitchRenderProps>['className']>
>

/**
 * 3. A plain React style object is acceptable too. Independent of 1: this is
 *    the half that was broken for the 21 components that use no React Aria at
 *    all, and it would still be broken if the fix had only added the function
 *    forms.
 */
export type PlainCssPropertiesIsAcceptable = Assert<Extends<CSSProperties, StyledProps['style']>>

/**
 * 4. What the render overload returns is spreadable onto the React Aria
 *    component it came from. Assignability of the props is the whole of what
 *    the JSX spread checks, so this is that check without a component.
 */
export type RenderResultIsSpreadable = Assert<
  Extends<StyledRenderProps<SwitchRenderProps>, Pick<SwitchProps, 'className' | 'style'>>
>

/**
 * 5. The static overload has NOT been widened. A function `className` on a
 *    plain `<div>` is a bug that renders `"(values) => …"` into the attribute,
 *    so the two overloads earn their existence only if this stays narrow — and
 *    collapsing them to one permissive signature is the obvious wrong fix that
 *    would satisfy 1 through 4.
 */
export type StaticClassNameStaysAString = Assert<
  Extends<NonNullable<StyledProps['className']>, string>
>

/**
 * 6. And the static `style` is still a plain object, for the same reason.
 *    `CSSProperties` is a supertype of what `stylex.props` returns, so this
 *    holds without loosening anything.
 */
export type StaticStyleStaysAnObject = Assert<
  Extends<NonNullable<StyledProps['style']>, CSSProperties>
>
