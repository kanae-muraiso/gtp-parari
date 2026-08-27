"use client";

import MessageThreadPanel from "@/components/parari/messages/MessageThreadPanel";


type ApplicationEntryMessagePanelProps = {
  entryId: string;
  counterpartLabel: string;
  onClose?: () => void;
};


export default function ApplicationEntryMessagePanel({
  entryId,
  counterpartLabel,
  onClose,
}: ApplicationEntryMessagePanelProps) {
  return (
    <MessageThreadPanel
      contextType="application"
      contextId={entryId}
      fallbackCounterpartLabel={
        counterpartLabel
      }
      onClose={onClose}
    />
  );
}
