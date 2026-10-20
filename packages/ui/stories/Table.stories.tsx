/**
 * Two things here are easy to "tidy" back into being broken. Both are measured.
 *
 * **Columns are direct children of `TableHeader`, never wrapped in a
 * `TableRow`.** React Aria's `TableHeaderProps.children` is documented as "a
 * list of `Column(s)` or a function", and it builds the header row itself. Wrap
 * the columns in a row and the collection counts the wrapper as **one** column;
 * every body row then has three cells against one column and rendering throws.
 * Before this was fixed, 8 of these 9 stories rendered nothing at all. `Empty`
 * was the survivor, and only because it has no body rows for the count to
 * disagree with — so the one story that worked was the one with nothing in it.
 *
 * **`size` and `sticky` are threaded to the subcomponents, not just to
 * `<Table>`.** Their variants are defined only on the slots rendered by
 * `TableColumn`/`TableCell` and `TableHeader`; `Table` itself renders the
 * `container` and `table` slots. Root-only values therefore change nothing.
 * With `size` set on the root only, `Default`, `Compact` and `Relaxed` emitted
 * byte-identical markup: three stories documenting a prop with no effect.
 * Threaded, they pick different column and cell size styles (a `2.25rem` vs
 * `2rem` header with `0.875rem` vs `0.75rem` text, `0.625rem` vs `0.25rem` cell
 * padding). The sticky story similarly passes the flag to the header whose
 * position actually changes.
 *
 * The inert root props are component-ergonomics defects, not story defects.
 * Fixing them changes behaviour, so it is deliberately left for its own
 * change; these stories document the API as it actually is.
 */

import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { expect, fireEvent, userEvent, within } from 'storybook/test'

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableColumn,
  TableCheckboxCell,
  TableSelectAllColumn,
  type SortDescriptor,
  type TableProps,
} from '../src/components/Table/Table.tsx'

const meta: Meta<typeof Table> = {
  title: 'Components/Table',
  component: Table,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['compact', 'default', 'relaxed'],
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

const sampleData = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User' },
  { id: 4, name: 'Alice Brown', email: 'alice@example.com', role: 'Moderator' },
  { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', role: 'User' },
]

const markPlayCompleted = (canvasElement: HTMLElement) => {
  canvasElement.dataset.tablePlay = 'completed'
}

const SortableTable = ({ size, ...props }: Omit<TableProps, 'children'>) => {
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: 'name',
    direction: 'descending',
  })
  const rows = [...sampleData].sort((left, right) => {
    const column =
      sortDescriptor.column === 'email'
        ? 'email'
        : sortDescriptor.column === 'role'
          ? 'role'
          : 'name'
    const order = left[column].localeCompare(right[column])
    return sortDescriptor.direction === 'ascending' ? order : -order
  })

  return (
    <Table
      {...props}
      size={size}
      sortDescriptor={sortDescriptor}
      onSortChange={setSortDescriptor}
      aria-label="Users, sortable"
    >
      <TableHeader size={size}>
        <TableColumn id="name" size={size} allowsSorting>
          Name
        </TableColumn>
        <TableColumn id="email" size={size} allowsSorting>
          Email
        </TableColumn>
        <TableColumn id="role" size={size} allowsSorting>
          Role
        </TableColumn>
      </TableHeader>
      <TableBody size={size}>
        {rows.map((row) => (
          <TableRow size={size} key={row.id}>
            <TableCell size={size}>{row.name}</TableCell>
            <TableCell size={size}>{row.email}</TableCell>
            <TableCell size={size}>{row.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export const Default: Story = {
  render: ({ size, ...args }) => (
    <Table {...args} size={size} aria-label="Users">
      <TableHeader size={size}>
        <TableColumn size={size}>Name</TableColumn>
        <TableColumn size={size}>Email</TableColumn>
        <TableColumn size={size}>Role</TableColumn>
      </TableHeader>
      <TableBody size={size}>
        {sampleData.map((row) => (
          <TableRow size={size} key={row.id}>
            <TableCell size={size}>{row.name}</TableCell>
            <TableCell size={size}>{row.email}</TableCell>
            <TableCell size={size}>{row.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
  args: {
    size: 'default',
  },
}

export const KeyboardFocus: Story = {
  render: ({ size, ...args }) => (
    <Table {...args} size={size} aria-label="Users, keyboard focus">
      <TableHeader size={size}>
        <TableColumn size={size}>Name</TableColumn>
        <TableColumn size={size}>Email</TableColumn>
        <TableColumn size={size}>Role</TableColumn>
      </TableHeader>
      <TableBody size={size}>
        {sampleData.map((row) => (
          <TableRow size={size} key={row.id}>
            <TableCell size={size}>{row.name}</TableCell>
            <TableCell size={size}>{row.email}</TableCell>
            <TableCell size={size}>{row.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
  args: {
    size: 'default',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const table = canvas.getByRole('grid', { name: 'Users, keyboard focus' })

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await userEvent.tab()
      if (table.querySelector('[data-focus-visible]') !== null) break
    }

    const focusVisible = table.querySelector('[data-focus-visible]')
    await expect(focusVisible).toBe(canvasElement.ownerDocument.activeElement)
    await expect(focusVisible).toHaveAttribute('data-focus-visible', 'true')
    markPlayCompleted(canvasElement)
  },
}

export const Compact: Story = {
  render: ({ size, ...args }) => (
    <Table {...args} size={size} aria-label="Users">
      <TableHeader size={size}>
        <TableColumn size={size}>Name</TableColumn>
        <TableColumn size={size}>Email</TableColumn>
        <TableColumn size={size}>Role</TableColumn>
      </TableHeader>
      <TableBody size={size}>
        {sampleData.map((row) => (
          <TableRow size={size} key={row.id}>
            <TableCell size={size}>{row.name}</TableCell>
            <TableCell size={size}>{row.email}</TableCell>
            <TableCell size={size}>{row.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
  args: {
    size: 'compact',
  },
}

export const Relaxed: Story = {
  render: ({ size, ...args }) => (
    <Table {...args} size={size} aria-label="Users">
      <TableHeader size={size}>
        <TableColumn size={size}>Name</TableColumn>
        <TableColumn size={size}>Email</TableColumn>
        <TableColumn size={size}>Role</TableColumn>
      </TableHeader>
      <TableBody size={size}>
        {sampleData.map((row) => (
          <TableRow size={size} key={row.id}>
            <TableCell size={size}>{row.name}</TableCell>
            <TableCell size={size}>{row.email}</TableCell>
            <TableCell size={size}>{row.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
  args: {
    size: 'relaxed',
  },
}

export const WithSorting: Story = {
  render: ({ size, ...args }) => <SortableTable {...args} size={size} />,
  args: {
    size: 'default',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nameColumn = canvas.getByRole('columnheader', { name: /Name/ })

    await expect(nameColumn).toHaveAttribute('aria-sort', 'descending')
    await userEvent.click(nameColumn)
    await expect(nameColumn).toHaveAttribute('aria-sort', 'ascending')
    await expect(nameColumn.querySelector('[data-sort-direction="ascending"]')).toBeVisible()
    await expect(canvas.getAllByRole('row')[1]).toHaveTextContent('Alice Brown')
    markPlayCompleted(canvasElement)
  },
}

export const WithSelection: Story = {
  render: ({ size, ...args }) => (
    <Table {...args} selectionMode="multiple" size={size} aria-label="Users, selectable">
      <TableHeader size={size}>
        <TableSelectAllColumn size={size} />
        <TableColumn size={size}>Name</TableColumn>
        <TableColumn size={size}>Email</TableColumn>
        <TableColumn size={size}>Role</TableColumn>
      </TableHeader>
      <TableBody size={size}>
        {sampleData.map((row) => (
          <TableRow size={size} key={row.id}>
            <TableCheckboxCell size={size} />
            <TableCell size={size}>{row.name}</TableCell>
            <TableCell size={size}>{row.email}</TableCell>
            <TableCell size={size}>{row.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
  args: {
    size: 'default',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const checkboxes = canvas.getAllByRole('checkbox')
    const selectAll = checkboxes.at(0)
    const firstRowCheckbox = checkboxes.at(1)
    const firstRow = canvas.getAllByRole('row').at(1)
    await expect(checkboxes).toHaveLength(6)
    if (selectAll === undefined || firstRowCheckbox === undefined || firstRow === undefined) return
    await userEvent.click(firstRowCheckbox)
    await userEvent.hover(firstRow)
    await expect(firstRow).toHaveAttribute('data-selected', 'true')
    await expect(firstRow).toHaveAttribute('data-hovered', 'true')
    await expect(selectAll).toBePartiallyChecked()

    await userEvent.click(selectAll)
    await expect(selectAll).toBeChecked()
    for (const row of canvas.getAllByRole('row').slice(1)) {
      await expect(row).toHaveAttribute('data-selected', 'true')
    }
    markPlayCompleted(canvasElement)
  },
}

export const Resizable: Story = {
  render: ({ size, ...args }) => (
    <Table {...args} resizable size={size} aria-label="Users, resizable columns">
      <TableHeader size={size}>
        <TableColumn size={size} allowsResizing columnWidth={200} minWidth={100}>
          Name
        </TableColumn>
        <TableColumn size={size} allowsResizing columnWidth={250} minWidth={150}>
          Email
        </TableColumn>
        <TableColumn size={size} allowsResizing columnWidth={150} minWidth={80}>
          Role
        </TableColumn>
      </TableHeader>
      <TableBody size={size}>
        {sampleData.map((row) => (
          <TableRow size={size} key={row.id}>
            <TableCell size={size}>{row.name}</TableCell>
            <TableCell size={size}>{row.email}</TableCell>
            <TableCell size={size}>{row.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
  args: {
    size: 'default',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nameColumn = canvas.getByRole('columnheader', { name: /Name/ })
    const resizer = canvas.getAllByRole('presentation').at(0)
    const slider = canvas.getByRole('slider', { name: 'Resizer Name' })
    await expect(resizer).toBeDefined()
    if (resizer === undefined) return

    const before = Number(slider.getAttribute('value'))
    await expect(resizer).toBeVisible()
    const bounds = resizer.getBoundingClientRect()
    fireEvent.pointerDown(resizer, {
      clientX: bounds.x + 1,
      clientY: bounds.y + 4,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
    })
    fireEvent.pointerMove(resizer, {
      clientX: bounds.x + 41,
      clientY: bounds.y + 4,
      pointerId: 1,
      pointerType: 'mouse',
      buttons: 1,
    })
    fireEvent.pointerUp(resizer, {
      clientX: bounds.x + 41,
      clientY: bounds.y + 4,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons: 0,
    })

    await expect(Number(slider.getAttribute('value'))).toBeGreaterThan(before)
    await expect(nameColumn.getBoundingClientRect().width).toBeGreaterThan(200)
    markPlayCompleted(canvasElement)
  },
}

export const StickyHeader: Story = {
  render: ({ size, ...args }) => (
    <div data-testid="sticky-scroll-container" style={{ height: '200px', overflow: 'auto' }}>
      <Table {...args} sticky size={size} aria-label="Users, sticky header">
        <TableHeader size={size} sticky>
          <TableColumn size={size}>Name</TableColumn>
          <TableColumn size={size}>Email</TableColumn>
          <TableColumn size={size}>Role</TableColumn>
        </TableHeader>
        <TableBody size={size}>
          {[...sampleData, ...sampleData, ...sampleData].map((row, i) => (
            <TableRow size={size} key={i}>
              <TableCell size={size}>{row.name}</TableCell>
              <TableCell size={size}>{row.email}</TableCell>
              <TableCell size={size}>{row.role}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
  args: {
    size: 'default',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const scrollContainer = canvas.getByTestId('sticky-scroll-container')
    const header = canvas.getAllByRole('rowgroup').at(0)
    await expect(header).toBeDefined()
    if (header === undefined) return

    scrollContainer.scrollTop = 120
    fireEvent.scroll(scrollContainer)

    await expect(scrollContainer.scrollTop).toBe(120)
    await expect(header).toBeVisible()
    await expect(getComputedStyle(header).position).toBe('sticky')
    markPlayCompleted(canvasElement)
  },
}

export const Loading: Story = {
  render: ({ size, ...args }) => (
    <Table {...args} size={size} aria-label="Users, loading">
      <TableHeader size={size}>
        <TableColumn size={size}>Name</TableColumn>
        <TableColumn size={size}>Email</TableColumn>
        <TableColumn size={size}>Role</TableColumn>
      </TableHeader>
      <TableBody size={size} isLoading loadingRowCount={5} columnCount={3}>
        {[]}
      </TableBody>
    </Table>
  ),
  args: {
    size: 'default',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('row')).toHaveLength(6)
    await expect(canvas.queryByText('John Doe')).not.toBeInTheDocument()
    markPlayCompleted(canvasElement)
  },
}

export const Empty: Story = {
  render: ({ size, ...args }) => (
    <Table {...args} size={size} aria-label="Users, empty">
      <TableHeader size={size}>
        <TableColumn size={size}>Name</TableColumn>
        <TableColumn size={size}>Email</TableColumn>
        <TableColumn size={size}>Role</TableColumn>
      </TableHeader>
      <TableBody size={size} emptyState="No users found">
        {[]}
      </TableBody>
    </Table>
  ),
  args: {
    size: 'default',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('No users found')).toBeVisible()
    await expect(canvas.getAllByRole('row')).toHaveLength(3)
    markPlayCompleted(canvasElement)
  },
}
