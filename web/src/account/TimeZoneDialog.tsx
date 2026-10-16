// STUB: brief 09 replaces this file with the time zone picker (same props).
import { Button } from "../components/Button";
import { Dialog } from "../components/Dialog";
import { useSettings } from "../data/settings";
import "../styles/stubs.css";

export interface TimeZoneDialogProps {
  open: boolean;
  onClose(): void;
}

/** Until brief 09: says which zone times show in, and closes. */
export function TimeZoneDialog({ open, onClose }: TimeZoneDialogProps) {
  const { timeZone } = useSettings();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Time zone"
      size="small"
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <p className="stub-text">Times show in {timeZone}, wherever you are.</p>
    </Dialog>
  );
}
