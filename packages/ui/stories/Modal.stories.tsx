import type { Meta, StoryObj } from '@storybook/react'
import * as stylex from '@stylexjs/stylex'

import { Button } from '../src/components/Button/mod.ts'
import {
  Modal,
  ModalTrigger,
  ModalDialog,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalContent,
  ModalFooter,
} from '../src/components/Modal/mod.ts'
import { styled } from '../src/foundations/props.ts'
import { scale } from '../src/foundations/tokens.stylex.ts'

const storyStyles = stylex.create({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space4,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: scale.space2,
  },
  label: {
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    fontWeight: 500,
  },
  input: {
    boxSizing: 'border-box',
    width: '100%',
    margin: 0,
    paddingInline: scale.space3,
    paddingBlock: scale.space2,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'currentColor',
    borderRadius: scale.radiusDefault,
    backgroundColor: 'transparent',
    color: 'inherit',
    font: 'inherit',
  },
  scrollArea: {
    maxHeight: '300px',
    overflowY: 'auto',
  },
  paragraph: {
    margin: 0,
  },
  paragraphSpaced: {
    marginBottom: scale.space4,
  },
  storyActions: {
    display: 'flex',
    gap: scale.space4,
  },
})

const meta = {
  title: 'Components/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Modal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: null,
  },
  render: () => (
    <ModalTrigger>
      <Button>Open Modal</Button>
      <Modal>
        <ModalDialog>
          <ModalHeader>
            <ModalTitle>Create Token</ModalTitle>
            <ModalDescription>
              Enter a unique name for your token to differentiate it from other tokens and then
              select the scope.
            </ModalDescription>
          </ModalHeader>
          <ModalContent>
            <p {...styled(undefined, storyStyles.paragraph)}>
              Some content contained within the modal.
            </p>
          </ModalContent>
          <ModalFooter>
            <Button variant="secondary">Cancel</Button>
            <Button>Submit</Button>
          </ModalFooter>
        </ModalDialog>
      </Modal>
    </ModalTrigger>
  ),
}

export const WithForm: Story = {
  args: {
    children: null,
  },
  render: () => (
    <ModalTrigger>
      <Button>Edit Profile</Button>
      <Modal>
        <ModalDialog>
          <ModalHeader>
            <ModalTitle>Edit Profile</ModalTitle>
            <ModalDescription>
              Make changes to your profile here. Click save when you're done.
            </ModalDescription>
          </ModalHeader>
          <ModalContent>
            <div {...styled(undefined, storyStyles.form)}>
              <div {...styled(undefined, storyStyles.field)}>
                <label {...styled(undefined, storyStyles.label)}>Name</label>
                <input {...styled(undefined, storyStyles.input)} defaultValue="John Doe" />
              </div>
              <div {...styled(undefined, storyStyles.field)}>
                <label {...styled(undefined, storyStyles.label)}>Email</label>
                <input {...styled(undefined, storyStyles.input)} defaultValue="john@example.com" />
              </div>
            </div>
          </ModalContent>
          <ModalFooter>
            <Button variant="secondary">Cancel</Button>
            <Button>Save Changes</Button>
          </ModalFooter>
        </ModalDialog>
      </Modal>
    </ModalTrigger>
  ),
}

export const Confirmation: Story = {
  args: {
    children: null,
  },
  render: () => (
    <ModalTrigger>
      <Button variant="error">Delete Account</Button>
      <Modal>
        <ModalDialog>
          <ModalHeader>
            <ModalTitle>Delete Account</ModalTitle>
            <ModalDescription>
              Are you sure you want to delete your account? This action cannot be undone.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button variant="secondary">Cancel</Button>
            <Button variant="error">Delete</Button>
          </ModalFooter>
        </ModalDialog>
      </Modal>
    </ModalTrigger>
  ),
}

export const SingleButton: Story = {
  args: {
    children: null,
  },
  render: () => (
    <ModalTrigger>
      <Button>Show Info</Button>
      <Modal>
        <ModalDialog>
          <ModalHeader>
            <ModalTitle>Information</ModalTitle>
            <ModalDescription>Your changes have been saved successfully.</ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button>Got it</Button>
          </ModalFooter>
        </ModalDialog>
      </Modal>
    </ModalTrigger>
  ),
}

export const LongContent: Story = {
  args: {
    children: null,
  },
  render: () => (
    <ModalTrigger>
      <Button>Terms of Service</Button>
      <Modal>
        <ModalDialog>
          <ModalHeader>
            <ModalTitle>Terms of Service</ModalTitle>
            <ModalDescription>Please read and accept our terms of service.</ModalDescription>
          </ModalHeader>
          <ModalContent>
            <div {...styled(undefined, storyStyles.scrollArea)}>
              <p {...styled(undefined, storyStyles.paragraph, storyStyles.paragraphSpaced)}>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                incididunt ut labore et dolore magna aliqua.
              </p>
              <p {...styled(undefined, storyStyles.paragraph, storyStyles.paragraphSpaced)}>
                Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip
                ex ea commodo consequat.
              </p>
              <p {...styled(undefined, storyStyles.paragraph, storyStyles.paragraphSpaced)}>
                Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
                fugiat nulla pariatur.
              </p>
              <p {...styled(undefined, storyStyles.paragraph, storyStyles.paragraphSpaced)}>
                Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
                mollit anim id est laborum.
              </p>
              <p {...styled(undefined, storyStyles.paragraph)}>
                Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium
                doloremque laudantium, totam rem aperiam.
              </p>
            </div>
          </ModalContent>
          <ModalFooter>
            <Button variant="secondary">Decline</Button>
            <Button>Accept</Button>
          </ModalFooter>
        </ModalDialog>
      </Modal>
    </ModalTrigger>
  ),
}

export const AllStates: Story = {
  args: {
    children: null,
  },
  render: () => (
    <div {...styled(undefined, storyStyles.storyActions)}>
      <ModalTrigger>
        <Button>Default Modal</Button>
        <Modal>
          <ModalDialog>
            <ModalHeader>
              <ModalTitle>Default Modal</ModalTitle>
              <ModalDescription>
                This is a default modal with title, description, and actions.
              </ModalDescription>
            </ModalHeader>
            <ModalContent>
              <p {...styled(undefined, storyStyles.paragraph)}>Modal content goes here.</p>
            </ModalContent>
            <ModalFooter>
              <Button variant="secondary">Cancel</Button>
              <Button>Submit</Button>
            </ModalFooter>
          </ModalDialog>
        </Modal>
      </ModalTrigger>

      <ModalTrigger>
        <Button variant="error">Confirmation</Button>
        <Modal>
          <ModalDialog>
            <ModalHeader>
              <ModalTitle>Confirm Action</ModalTitle>
              <ModalDescription>Are you sure you want to proceed?</ModalDescription>
            </ModalHeader>
            <ModalFooter>
              <Button variant="secondary">Cancel</Button>
              <Button variant="error">Confirm</Button>
            </ModalFooter>
          </ModalDialog>
        </Modal>
      </ModalTrigger>
    </div>
  ),
}
