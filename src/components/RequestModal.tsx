import Modal from './Modal'
import Button from './Button'

interface RequestModalProps {
  isOpen: boolean
  title: string
  description: string
  onAccept: () => void
  onReject: () => void
  acceptText?: string
  rejectText?: string
}

export default function RequestModal({
  isOpen,
  title,
  description,
  onAccept,
  onReject,
  acceptText = 'Принять',
  rejectText = 'Отклонить'
}: RequestModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onReject}
      title={title}
      description={description}
    >
      <div className="grid grid-cols-2 gap-4 mt-6">
        <Button
          variant="outline"
          onClick={onReject}
          className="w-full"
        >
          {rejectText}
        </Button>
        <Button
          variant="primary"
          onClick={onAccept}
          className="w-full"
        >
          {acceptText}
        </Button>
      </div>
    </Modal>
  )
}
